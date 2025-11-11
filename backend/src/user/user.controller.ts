import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UserFiltersService } from './user-filters.service';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, UserRole } from '../auth/decorators/roles.decorator';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto } from './dto/user.dto';
import { SaveUserFiltersDto, UserFiltersResponseDto } from './dto/user-filters.dto';

@ApiTags('users')
@Controller('users')
@UseGuards(AuthGuard)
@ApiBearerAuth('bearer')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly userFiltersService: UserFiltersService,
  ) {}

  /**
   * Get current user profile
   */
  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Request() req: any) {
    return this.userService.findById(req.user.id);
  }

  /**
   * Update current user profile
   */
  @Put('profile')
  @ApiOperation({ summary: 'Update current user profile' })
  async updateProfile(@Request() req: any, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.updateUser(req.user.id, updateUserDto);
  }

  /**
   * Change current user password
   */
  @Put('change-password')
  @ApiOperation({ summary: 'Change current user password' })
  @HttpCode(HttpStatus.OK)
  async changePassword(@Request() req: any, @Body() changePasswordDto: ChangePasswordDto) {
    return this.userService.changePassword(req.user.id, changePasswordDto.newPassword);
  }

  /**
   * Get all users (Admin only)
   */
  @Get()
  @ApiOperation({ summary: 'List all users (admin)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAll() {
    return this.userService.findAll();
  }

  /**
   * Create new user (Admin only)
   */
  @Post()
  @ApiOperation({ summary: 'Create user (admin)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async create(@Body() createUserDto: CreateUserDto) {
    return this.userService.createUser(createUserDto);
  }

  // ============ FILTER ROUTES (must come BEFORE :id routes) ============

  /**
   * Get default filters
   */
  @Get('filters/default')
  @ApiOperation({ summary: 'Get default user filters' })
  @ApiResponse({
    status: 200,
    description: 'Default filters retrieved successfully',
    type: UserFiltersResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Default filters not found' })
  async getDefaultFilters(@Request() req: any): Promise<UserFiltersResponseDto | null> {
    return this.userFiltersService.getDefaultFilters(req.user.id);
  }

  /**
   * Save default filters
   */
  @Put('filters/default')
  @ApiOperation({ summary: 'Save default user filters' })
  @ApiResponse({
    status: 200,
    description: 'Default filters saved successfully',
    type: UserFiltersResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid filter data' })
  async saveDefaultFilters(
    @Request() req: any,
    @Body() dto: Omit<SaveUserFiltersDto, 'name'>,
  ): Promise<UserFiltersResponseDto> {
    return this.userFiltersService.saveDefaultFilters(req.user.id, dto);
  }

  /**
   * Get user filters
   */
  @Get('filters')
  @ApiOperation({ summary: 'Get all user filters' })
  @ApiResponse({
    status: 200,
    description: 'User filters retrieved successfully',
    type: [UserFiltersResponseDto],
  })
  async getFilters(@Request() req: any): Promise<UserFiltersResponseDto[]> {
    return this.userFiltersService.getUserFilters(req.user.id);
  }

  /**
   * Save user filters
   */
  @Post('filters')
  @ApiOperation({ summary: 'Save user filters' })
  @ApiResponse({
    status: 201,
    description: 'Filters saved successfully',
    type: UserFiltersResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid filter data' })
  @ApiResponse({ status: 409, description: 'Filter name already exists' })
  async saveFilters(
    @Request() req: any,
    @Body() dto: SaveUserFiltersDto,
  ): Promise<UserFiltersResponseDto> {
    return this.userFiltersService.saveUserFilters(req.user.id, dto);
  }

  /**
   * Get user filter by ID
   */
  @Get('filters/:id')
  @ApiOperation({ summary: 'Get user filter by ID' })
  @ApiParam({ name: 'id', description: 'Filter ID' })
  @ApiResponse({
    status: 200,
    description: 'User filter retrieved successfully',
    type: UserFiltersResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Filter not found' })
  async getFilterById(
    @Request() req: any,
    @Param('id', ParseIntPipe) filterId: number,
  ): Promise<UserFiltersResponseDto> {
    return this.userFiltersService.getUserFilterById(req.user.id, filterId);
  }

  /**
   * Delete user filter
   */
  @Delete('filters/:id')
  @ApiOperation({ summary: 'Delete user filter' })
  @ApiParam({ name: 'id', description: 'Filter ID' })
  @ApiResponse({ status: 200, description: 'Filter deleted successfully' })
  @ApiResponse({ status: 404, description: 'Filter not found' })
  @HttpCode(HttpStatus.OK)
  async deleteFilter(
    @Request() req: any,
    @Param('id', ParseIntPipe) filterId: number,
  ): Promise<{ message: string }> {
    await this.userFiltersService.deleteUserFilter(req.user.id, filterId);
    return { message: 'Filter deleted successfully' };
  }

  // ============ USER ID ROUTES (must come AFTER specific routes) ============

  /**
   * Get user by ID (Admin only)
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get user by id (admin)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findById(id);
  }

  /**
   * Update user (Admin only)
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update user (admin)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.updateUser(id, updateUserDto);
  }

  /**
   * Delete user (Admin only)
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete user (admin)' })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.deleteUser(id);
  }
}
