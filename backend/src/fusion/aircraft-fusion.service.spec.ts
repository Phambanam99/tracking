import { AircraftFusionService } from './aircraft-fusion.service';
import { NormAircraftMsg } from './types';
import { FUSION_CONFIG } from './config';

class LastPublishedMock {
  private store = new Map<string, string>();
  async get(_type: 'vessel' | 'aircraft', key: string): Promise<string | undefined> {
    return this.store.get(key);
  }
  async set(_type: 'vessel' | 'aircraft', key: string, ts: string): Promise<void> {
    this.store.set(key, ts);
  }
}

function mkAircraft(
  p: Partial<NormAircraftMsg> & { ts: string; lat: number; lon: number },
): NormAircraftMsg {
  return {
    source: (p.source as any) ?? 'custom',
    ts: p.ts,
    icao24: p.icao24 ?? 'abcd12',
    registration: p.registration,
    callsign: p.callsign ?? 'TEST123',
    lat: p.lat,
    lon: p.lon,
    altitude: p.altitude,
    groundSpeed: p.groundSpeed,
    heading: p.heading,
    verticalRate: p.verticalRate,
  };
}

describe('AircraftFusionService', () => {
  const baseNow = Date.parse('2025-08-12T02:00:00Z');
  let fusion: AircraftFusionService;

  beforeEach(() => {
    fusion = new AircraftFusionService(new LastPublishedMock() as any);
  });

  it('prefers newer event-time within allowed lateness', async () => {
    const key = 'abcd12';
    const olderTs = new Date(baseNow - 4 * 60_000).toISOString();
    const newerTs = new Date(baseNow - 30_000).toISOString();

    fusion.ingest(
      [
        mkAircraft({ ts: olderTs, lat: 10, lon: 10, source: 'opensky' as any, icao24: key }),
        mkAircraft({ ts: newerTs, lat: 10.01, lon: 10.01, source: 'custom', icao24: key }),
      ],
      baseNow,
    );

    const decision = await fusion.decide(key, baseNow);
    expect(decision.publish).toBe(true);
    expect(decision.best?.ts).toBe(newerTs);
  });

  it('backfills when decided best is not newer than lastPublished', async () => {
    const key = 'abcd12';
    const lastTs = new Date(baseNow - 60_000).toISOString();
    const oldTs = new Date(baseNow - 3 * 60_000).toISOString();
    fusion.ingest([mkAircraft({ ts: lastTs, lat: 0, lon: 0, icao24: key })], baseNow);
    await fusion.markPublished(key, lastTs);

    fusion.ingest([mkAircraft({ ts: oldTs, lat: 0.001, lon: 0.001, icao24: key })], baseNow);
    const decision = await fusion.decide(key, baseNow);
    expect(decision.publish).toBe(false);
    expect(decision.backfillOnly).toBe(true);
  });

  it('does not publish when newer is beyond allowed lateness', async () => {
    const key = 'abcd12';
    const tooLateTs = new Date(baseNow - (FUSION_CONFIG.ALLOWED_LATENESS_MS + 5_000)).toISOString();
    fusion.ingest([mkAircraft({ ts: tooLateTs, lat: 1, lon: 1, icao24: key })], baseNow);
    await fusion.markPublished(key, new Date(baseNow - 60_000).toISOString());
    const decision = await fusion.decide(key, baseNow);
    expect(decision.publish).toBe(false);
  });
});

