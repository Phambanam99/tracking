import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private redisClient: Redis;
  private pubClient: Redis;
  private subClient: Redis;

  constructor(private config: ConfigService) {
    // Redis connection configuration
    const redisConfig = {
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: parseInt(this.config.get<string>('REDIS_PORT', '6379')),
      password: this.config.get<string | undefined>('REDIS_PASSWORD'),
      db: parseInt(this.config.get<string>('REDIS_DB', '0')),
    };

    // Main client for general operations
    this.redisClient = new Redis(redisConfig);

    // Dedicated clients for pub/sub
    this.pubClient = new Redis(redisConfig);
    this.subClient = new Redis(redisConfig);

    // Log connection status
    this.redisClient.on('connect', () => {
      console.log('✅ Redis client connected successfully');
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
    console.log('🔄 Disconnecting Redis clients...');
    await this.redisClient.quit();
    await this.pubClient.quit();
    await this.subClient.quit();
    console.log('✅ Redis clients disconnected');
  }

  // Health check method
  async ping(): Promise<string> {
    return this.redisClient.ping();
  }

  // Get clients for advanced usage
  getClient(): Redis {
    return this.redisClient;
  }

  getPubClient(): Redis {
    return this.pubClient;
  }

  getSubClient(): Redis {
    return this.subClient;
  }
}
