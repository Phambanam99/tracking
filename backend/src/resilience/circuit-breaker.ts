/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by stopping requests to failing services
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, reject all requests immediately
 * - HALF_OPEN: Testing if service recovered, allow limited requests
 *
 * Performance Impact:
 * - Prevents wasted resources on failing operations
 * - Faster failure detection and recovery
 * - Graceful degradation instead of total failure
 */

export enum CircuitBreakerState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, reject calls
  HALF_OPEN = 'HALF_OPEN', // Testing recovery
}

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Open after N failures (default: 5)
  successThreshold?: number; // Close after N successes in HALF_OPEN (default: 2)
  resetTimeout?: number; // Time before trying HALF_OPEN (default: 30s)
  name?: string; // Circuit breaker name for logging
}

export class CircuitBreaker {
  private state = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly resetTimeout: number;
  private readonly name: string;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.successThreshold = options.successThreshold ?? 2;
    this.resetTimeout = options.resetTimeout ?? 30000; // 30 seconds
    this.name = options.name ?? 'CircuitBreaker';
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is OPEN
    if (this.state === CircuitBreakerState.OPEN) {
      // Check if enough time has passed to try HALF_OPEN
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.successCount = 0;
       
      } else {
        throw new Error(`Circuit breaker is OPEN for ${this.name}`);
      }
    }

    try {
      // Execute the function
      const result = await fn();

      // Success handling
      this.onSuccess();

      return result;
    } catch (error) {
      // Failure handling
      this.onFailure();

      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        // Enough successes, close the circuit
        this.state = CircuitBreakerState.CLOSED;
        this.failureCount = 0;
        console.log(`[${this.name}] Circuit CLOSED - Service recovered`);
      }
    } else if (this.state === CircuitBreakerState.CLOSED) {
      // Gradually reduce failure count on success
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Failed during testing, reopen circuit
      this.state = CircuitBreakerState.OPEN;
      console.warn(`[${this.name}] Circuit OPEN - Recovery test failed`);
    } else if (this.failureCount >= this.failureThreshold) {
      // Too many failures, open circuit
      this.state = CircuitBreakerState.OPEN;
      console.warn(
        `[${this.name}] Circuit OPEN - Threshold reached (${this.failureCount} failures)`,
      );
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      name: this.name,
    };
  }

  /**
   * Manually reset circuit breaker
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    console.log(`[${this.name}] Circuit manually reset`);
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.state === CircuitBreakerState.OPEN;
  }

  /**
   * Check if circuit is closed (healthy)
   */
  isClosed(): boolean {
    return this.state === CircuitBreakerState.CLOSED;
  }
}
