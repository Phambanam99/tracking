import { FUSION_CONFIG } from './config';

export class EventTimeWindowStore<T extends { ts: string }> {
  private readonly windows = new Map<string, T[]>();
  private readonly lastPublished = new Map<string, string>();

  constructor(private readonly windowMs = FUSION_CONFIG.WINDOW_MS) {}

  push(key: string, message: T, now = Date.now()): void {
    const list = this.windows.get(key) ?? [];
    list.push(message);
    this.pruneList(list, now - this.windowMs);
    this.windows.set(key, list);
  }

  getWindow(key: string): T[] {
    return this.windows.get(key) ?? [];
  }

  setLastPublished(key: string, tsIso: string): void {
    this.lastPublished.set(key, tsIso);
  }

  getLastPublished(key: string): string | undefined {
    return this.lastPublished.get(key);
  }

  private pruneList(list: T[], thresholdMs: number): void {
    // Keep only elements within window by event time
    let i = 0;
    for (const m of list) {
      const t = Date.parse(m.ts);
      if (Number.isFinite(t) && t >= thresholdMs) break;
      i++;
    }
    if (i > 0) list.splice(0, i);
  }
}
