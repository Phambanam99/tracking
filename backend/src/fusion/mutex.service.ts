import { Injectable, Logger } from '@nestjs/common';

/**
 * Mutex Service for Atomic Operations
 *
 * Provides in-memory locking to ensure atomic ingest/decide operations
 */

@Injectable()
export class MutexService {
  private readonly logger = new Logger(MutexService.name);
  private locks = new Map<string, Promise<void>>();

  /**
   * Execute function with lock
   */
  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // Wait for existing lock
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }

    // Create new lock
    let release: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(key, lockPromise);

    try {
      return await fn();
    } finally {
      this.locks.delete(key);
      release!();
    }
  }

  /**
   * Check if key is locked
   */
  isLocked(key: string): boolean {
    return this.locks.has(key);
  }

  /**
   * Get lock count
   */
  getLockCount(): number {
    return this.locks.size;
  }
}
