import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserService } from './user.service';

@Injectable()
export class UserCleanupService {
  private readonly logger = new Logger(UserCleanupService.name);

  constructor(private userService: UserService) {}

  /**
   * Run cleanup of expired sessions every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredSessions() {
    try {
      this.logger.log('Running expired sessions cleanup...');
      const result = await this.userService.cleanupExpiredSessions();
      this.logger.log(`Cleaned up ${result.count} expired sessions`);
    } catch (error) {
      this.logger.error('Error during session cleanup:', error);
    }
  }

  /**
   * Run a more aggressive cleanup daily at midnight
   * This removes sessions older than 30 days regardless of expiry
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldSessions() {
    try {
      this.logger.log('Running old sessions cleanup...');
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.userService.cleanupOldSessions(thirtyDaysAgo);
      this.logger.log(`Cleaned up ${result.count} old sessions`);
    } catch (error) {
      this.logger.error('Error during old session cleanup:', error);
    }
  }
}
