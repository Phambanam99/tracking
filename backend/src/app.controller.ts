import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiVersionHeader } from './common/decorators/api-version-header.decorator';
@ApiTags('root')
@ApiVersionHeader()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}
}
