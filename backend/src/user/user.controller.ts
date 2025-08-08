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
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, UserRole } from '../auth/decorators/roles.decorator';
import {
  CreateUserDto,
  UpdateUserDto,
  ChangePasswordDto,
} from './dto/user.dto';

@Controller('users')
@UseGuards(AuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Get current user profile
   */
  @Get('profile')
  async getProfile(@Request() req: any) {
    return this.userService.findById(req.user.id);
  }

  /**
   * Update current user profile
   */
  @Put('profile')
  async updateProfile(
    @Request() req: any,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.updateUser(req.user.id, updateUserDto);
  }

  /**
   * Change current user password
   */
  @Put('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Request() req: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.userService.changePassword(
      req.user.id,
      changePasswordDto.newPassword,
    );
  }

  /**
   * Get all users (Admin only)
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAll() {
    return this.userService.findAll();
  }

  /**
   * Get user by ID (Admin only)
   */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findById(id);
  }

  /**
   * Create new user (Admin only)
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async create(@Body() createUserDto: CreateUserDto) {
    return this.userService.createUser(createUserDto);
  }

  /**
   * Update user (Admin only)
   */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.updateUser(id, updateUserDto);
  }

  /**
   * Delete user (Admin only)
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.userService.deleteUser(id);
  }
}
