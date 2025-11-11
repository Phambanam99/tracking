import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { DeadLetterQueueService } from './dlq.service';
import { DLQController } from './dlq.controller';

@Module({
  imports: [RedisModule, AuthModule],
  controllers: [DLQController],
  providers: [DeadLetterQueueService],
  exports: [DeadLetterQueueService],
})
export class ResilienceModule {}
