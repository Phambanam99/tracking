import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private redisClient: Redis;
  private redisClientNoPrefix: Redis;
  private pubClient: Redis;
  private subClient: Redis;
  private readonly keyPrefix: string;

  constructor(private config: ConfigService) {
    // Environment-specific key prefix
    const env = this.config.get<string>('NODE_ENV', 'development');
    this.keyPrefix = this.config.get<string>('REDIS_KEY_PREFIX', `ais:${env}:`);

    // Redis connection configuration
    const redisConfig = {
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: parseInt(this.config.get<string>('REDIS_PORT', '6379')),
      password: this.config.get<string | undefined>('REDIS_PASSWORD'),
      db: parseInt(this.config.get<string>('REDIS_DB', '0')),
      keyPrefix: this.keyPrefix,
    };

    // Config without prefix for modules that manage their own prefixes
    const redisConfigNoPrefix = { ...redisConfig, keyPrefix: undefined };

    // Main client for general operations (with prefix)
    this.redisClient = new Redis(redisConfig);

    // Client without prefix for explicit key management
    this.redisClientNoPrefix = new Redis(redisConfigNoPrefix);

    // Dedicated clients for pub/sub
    this.pubClient = new Redis(redisConfig);
    this.subClient = new Redis(redisConfig);

    // Log connection status
    this.redisClient.on('connect', () => {
    
    });

    this.redisClient.on('error', (err) => {
      console.error('❌ Redis client error:', err);
    });
  }

  // General Redis operations
  async get(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<'OK'> {
    if (ttl) {
      return this.redisClient.setex(key, ttl, value);
    }
    return this.redisClient.set(key, value);
  }

  async del(key: string): Promise<number> {
    return this.redisClient.del(key);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.redisClient.keys(pattern);
  }

  // Pub/Sub operations
  async publish(channel: string, message: string): Promise<number> {
    return this.pubClient.publish(channel, message);
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    await this.subClient.subscribe(channel);
    this.subClient.on('message', (receivedChannel, message) => {
      if (receivedChannel === channel) {
        callback(message);
      }
    });
  }

  async unsubscribe(channel: string): Promise<void> {
    await this.subClient.unsubscribe(channel);
  }

  // Cleanup on module destroy
  async onModuleDestroy() {
    await this.redisClient.quit();
    await this.redisClientNoPrefix.quit();
    await this.pubClient.quit();
    await this.subClient.quit();
  }

  // Health check method
  async ping(): Promise<string> {
    return this.redisClient.ping();
  }

  // Get clients for advanced usage
  getClient(): Redis {
    return this.redisClient;
  }

  /**
   * Get Redis client WITHOUT automatic key prefix
   * Use this when you need full control over key naming
   * Recommended for: ADSB, Aircraft, or any module with custom key schema
   */
  getClientWithoutPrefix(): Redis {
    return this.redisClientNoPrefix;
  }

  getPubClient(): Redis {
    return this.pubClient;
  }

  getSubClient(): Redis {
    return this.subClient;
  }

  /**
   * Get the current key prefix being used
   */
  getKeyPrefix(): string {
    return this.keyPrefix;
  }
}
