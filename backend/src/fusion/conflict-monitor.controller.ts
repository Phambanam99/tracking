import { Controller, Get, Query } from '@nestjs/common';
import { ConflictMonitorService } from './conflict-monitor.service';

@Controller('fusion/conflicts')
export class ConflictMonitorController {
  constructor(private readonly conflictMonitor: ConflictMonitorService) {}

  @Get()
  getMetrics() {
    return this.conflictMonitor.getMetrics();
  }

  @Get('recent')
  getRecentConflicts(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.conflictMonitor.getRecentConflicts(limitNum);
  }

  @Get('report')
  getReport() {
    const report = this.conflictMonitor.generateSummaryReport();
    return {
      report,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('range')
  getConflictsByTimeRange(@Query('start') start: string, @Query('end') end: string) {
    const startTime = new Date(start);
    const endTime = new Date(end);

    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new Error('Invalid date format. Use ISO format.');
    }

    return this.conflictMonitor.getConflictsByTimeRange(startTime, endTime);
  }

  @Get('reset')
  resetMetrics() {
    this.conflictMonitor.resetMetrics();
    return {
      message: 'Conflict metrics reset successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
