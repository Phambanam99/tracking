import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class LastPublishedService {
  constructor(private readonly redis: RedisService) {}

  private keyFor(entityType: 'vessel' | 'aircraft', entityKey: string): string {
    return `fusion:lastPublished:${entityType}:${entityKey}`;
  }

  async get(entityType: 'vessel' | 'aircraft', entityKey: string): Promise<string | undefined> {
    const v = await this.redis.get(this.keyFor(entityType, entityKey));
    return v ?? undefined;
  }

  async set(entityType: 'vessel' | 'aircraft', entityKey: string, tsIso: string): Promise<void> {
    await this.redis.set(this.keyFor(entityType, entityKey), tsIso);
  }
}
