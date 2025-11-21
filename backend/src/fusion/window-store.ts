import { FUSION_CONFIG } from './config';

export class EventTimeWindowStore<T extends { ts: string }> {
  private readonly windows = new Map<string, T[]>();
  private readonly lastPublished = new Map<string, string>();
  private readonly lastSeen = new Map<string, number>();

  constructor(
    private readonly windowMs = FUSION_CONFIG.WINDOW_MS,
    private readonly maxEventsPerKey = FUSION_CONFIG.MAX_EVENTS_PER_KEY,
    private readonly maxKeys = FUSION_CONFIG.MAX_TRACKED_KEYS,
  ) {}

  push(key: string, message: T, now = Date.now()): void {
    const list = this.windows.get(key) ?? [];
    list.push(message);
    this.pruneList(list, now - this.windowMs);

    if (this.maxEventsPerKey > 0 && list.length > this.maxEventsPerKey) {
      list.splice(0, list.length - this.maxEventsPerKey);
    }

    if (list.length === 0) {
      this.removeKey(key);
      return;
    }

    this.windows.set(key, list);
    const parsedTs = Date.parse(message.ts);
    this.lastSeen.set(key, Number.isFinite(parsedTs) ? parsedTs : now);

    if (this.maxKeys > 0 && this.windows.size > this.maxKeys) {
      this.evictOverflowKeys();
    }
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

  private removeKey(key: string): void {
    this.windows.delete(key);
    this.lastPublished.delete(key);
    this.lastSeen.delete(key);
  }

  private evictOverflowKeys(): void {
    const overflow = this.windows.size - this.maxKeys;
    if (overflow <= 0) return;

    const ordered = Array.from(this.lastSeen.entries()).sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < overflow && i < ordered.length; i++) {
      this.removeKey(ordered[i][0]);
    }
  }
}
