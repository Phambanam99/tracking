import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisJSONService } from './redis-json.service';

@Module({
  providers: [RedisService, RedisJSONService],
  exports: [RedisService, RedisJSONService],
})
export class RedisModule {}
