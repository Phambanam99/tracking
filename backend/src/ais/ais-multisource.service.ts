import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { merge, Subject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AisModel, QueryResultState } from './ais.types';
import { AisSignalrService } from './ais-signalr.service';

/**
 * Định nghĩa nguồn bổ sung (cấu hình qua ENV JSON AIS_EXTRA_SOURCES)
 */
export interface ExtraAisSourceConfig {
  id: string; // unique id
  host: string;
  device?: string;
  actionType?: string;
  userId?: number;
  query?: string;
}

interface InternalSource {
  cfg: ExtraAisSourceConfig;
  service: SingleAisSourceService;
}

/**
 * Service lightweight dùng lại logic connection một nguồn (clone tối giản từ AisSignalrService )
 * Không đăng ký provider ra ngoài, chỉ nội bộ AisMultiSourceService sử dụng.
 */
class SingleAisSourceService {
  private readonly logger = new Logger(SingleAisSourceService.name);
  private started = false;
  private readonly start$ = new Subject<{
    state: QueryResultState.Start;
    count: number;
    sourceId: string;
  }>();
  private readonly data$ = new Subject<{
    state: QueryResultState.Query;
    data: AisModel[];
    sourceId: string;
  }>();
  private readonly end$ = new Subject<{ state: QueryResultState.End; sourceId: string }>();

  public startStream$ = this.start$.asObservable();
  public dataStream$ = this.data$.asObservable();
  public endStream$ = this.end$.asObservable();

  constructor(
    private base: AisSignalrService,
    private cfg: ExtraAisSourceConfig,
  ) {}

  async ensureStarted() {
    if (this.started) return;
    // Tạm thời: tái sử dụng triggerQuery của default source với query override.
    // TODO: thực sự tạo kết nối riêng từng nguồn (cần factor out kết nối từ base service).
    this.started = true;
    // Giả lập Start (vì chưa mở nhiều kết nối riêng)
    this.start$.next({ state: QueryResultState.Start, count: -1, sourceId: this.cfg.id });
  }

  feedData(batch: AisModel[]) {
    const enriched = batch.map((r) => ({ ...r, sourceId: this.cfg.id }));
    this.data$.next({ state: QueryResultState.Query, data: enriched, sourceId: this.cfg.id });
  }

  end() {
    this.end$.next({ state: QueryResultState.End, sourceId: this.cfg.id });
  }
}

@Injectable()
export class AisMultiSourceService implements OnModuleInit {
  private readonly logger = new Logger(AisMultiSourceService.name);
  private readonly sources: InternalSource[] = [];

  // Merged observables
  public mergedStart$!: Observable<{
    state: QueryResultState.Start;
    count: number;
    sourceId: string;
  }>;
  public mergedData$!: Observable<{
    state: QueryResultState.Query;
    data: AisModel[];
    sourceId: string;
  }>;
  public mergedEnd$!: Observable<{ state: QueryResultState.End; sourceId: string }>;

  constructor(private readonly defaultSource: AisSignalrService) {}

  onModuleInit() {
    this.loadExtraSources();
    this.buildMergedStreams();
  }

  /** Parse ENV AIS_EXTRA_SOURCES */
  private loadExtraSources() {
    const raw = process.env.AIS_EXTRA_SOURCES;
    if (!raw) {
      this.logger.log('No AIS_EXTRA_SOURCES found');
      return;
    }
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      for (const cfg of arr) {
        if (!cfg.id || !cfg.host) {
          this.logger.warn('Skip invalid extra source entry');
          continue;
        }
        const internal: InternalSource = {
          cfg,
          service: new SingleAisSourceService(this.defaultSource, cfg),
        };
        this.sources.push(internal);
      }
      this.logger.log(`Loaded ${this.sources.length} extra AIS sources`);
    } catch (e: any) {
      this.logger.error('Failed parse AIS_EXTRA_SOURCES: ' + e.message);
    }
  }

  private buildMergedStreams() {
    // Mặc định merged gồm default source + extra sources.
    const startStreams: Observable<{
      state: QueryResultState.Start;
      count: number;
      sourceId: string;
    }>[] = [this.defaultSource.startStream$.pipe(map((v) => ({ ...v, sourceId: 'default' })))];
    const dataStreams: Observable<{
      state: QueryResultState.Query;
      data: AisModel[];
      sourceId: string;
    }>[] = [
      this.defaultSource.dataStream$.pipe(
        map((v) => ({
          ...v,
          sourceId: 'default',
          data: (v.data || []).map((r: AisModel) => ({ ...r, sourceId: 'default' })),
        })),
      ),
    ];
    const endStreams: Observable<{
      state: QueryResultState.End;
      sourceId: string;
    }>[] = [this.defaultSource.endStream$.pipe(map((v) => ({ ...v, sourceId: 'default' })))];

    // Tạm thời: vì chưa có real multi connection, chúng ta chỉ dùng default source data và replicate sang extra sources.
    this.defaultSource.dataStream$.subscribe(({ data }) => {
      for (const s of this.sources) {
        void s.service.ensureStarted();
        s.service.feedData(data);
      }
    });
    this.defaultSource.endStream$.subscribe(() => {
      for (const s of this.sources) s.service.end();
    });

    for (const s of this.sources) {
      startStreams.push(s.service.startStream$);
      dataStreams.push(s.service.dataStream$);
      endStreams.push(s.service.endStream$);
    }

    this.mergedStart$ = merge(...startStreams);
    this.mergedData$ = merge(...dataStreams);
    this.mergedEnd$ = merge(...endStreams);
  }
}
