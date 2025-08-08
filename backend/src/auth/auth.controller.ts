import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { AuthGuard } from './guards/auth.guard';
import { LoginDto, RegisterDto, RefreshTokenDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Login endpoint
   */
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Request() req: any, @Body() loginDto: LoginDto) {
    return this.authService.login(req.user);
  }

  /**
   * Register endpoint
   */
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    const user = await this.authService.register(registerDto);
    return {
      message: 'User registered successfully',
      user,
    };
  }

  /**
   * Refresh token endpoint
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refresh_token);
  }

  /**
   * Logout endpoint
   */
  @UseGuards(AuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req: any) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    return this.authService.logout(token);
  }

  /**
   * Get current user info
   */
  @UseGuards(AuthGuard)
  @Post('me')
  @HttpCode(HttpStatus.OK)
  async getMe(@Request() req: any) {
    return {
      user: req.user,
    };
  }
}
