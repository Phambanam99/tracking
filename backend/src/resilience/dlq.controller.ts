import { Controller, Get, Post, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DeadLetterQueueService } from './dlq.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, UserRole } from '../auth/decorators/roles.decorator';

@ApiTags('dlq')
@Controller('admin/dlq')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('bearer')
export class DLQController {
  constructor(private readonly dlqService: DeadLetterQueueService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get DLQ statistics' })
  async getStats() {
    return this.dlqService.getStats();
  }

  @Get('peek')
  @ApiOperation({ summary: 'Peek at DLQ messages without removing them' })
  async peek(@Query('count') count?: string) {
    const limit = count ? parseInt(count, 10) : 10;
    return this.dlqService.peek(limit);
  }

  @Post('retry')
  @ApiOperation({ summary: 'Manually trigger DLQ retry' })
  async retryNow() {
    await this.dlqService.retryDLQ();
    return { message: 'DLQ retry triggered' };
  }

  @Delete('clear')
  @ApiOperation({ summary: 'Clear DLQ (admin only)' })
  async clear() {
    const count = await this.dlqService.clear();
    return { message: `Cleared ${count} messages from DLQ` };
  }

  @Delete('dead-letter')
  @ApiOperation({ summary: 'Clear dead letter queue (admin only)' })
  async clearDeadLetter() {
    const count = await this.dlqService.clearDeadLetter();
    return { message: `Cleared ${count} messages from dead letter queue` };
  }
}
