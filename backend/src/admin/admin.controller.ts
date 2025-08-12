import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService, SystemSettings } from './admin.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@ApiTags('admin')
@Controller('admin')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get system settings' })
  async getSettings(): Promise<SystemSettings> {
    return this.adminService.getSettings();
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update system settings' })
  async updateSettings(@Body() body: Partial<SystemSettings>): Promise<SystemSettings> {
    return this.adminService.updateSettings(body);
  }
}
