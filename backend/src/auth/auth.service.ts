import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  /**
   * Validate user credentials
   */
  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.userService.findByUsername(username);

    if (!user) {
      return null;
    }

    if (!user.isActive) {
      return null;
    }

    const isPasswordValid = await this.userService.validatePassword(password, user.password);

    if (isPasswordValid) {
      const { password: _, ...result } = user;
      return result;
    }

    return null;
  }

  /**
   * Login user and return tokens
   */
  async login(user: any) {
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    // Store session in database
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour

    await this.userService.createSession(user.id, accessToken, refreshToken, expiresAt);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600, // 1 hour in seconds
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  /**
   * Register new user
   */
  async register(userData: {
    email: string;
    username: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) {
    // Check if user already exists
    const existingUserByEmail = await this.userService.findByEmail(userData.email);
    if (existingUserByEmail) {
      throw new Error('User with this email already exists');
    }

    const existingUserByUsername = await this.userService.findByUsername(userData.username);
    if (existingUserByUsername) {
      throw new Error('User with this username already exists');
    }

    // Create new user
    const user = await this.userService.createUser({
      ...userData,
      role: UserRole.USER, // Default role
    });

    return user;
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string) {
    try {
      const decoded = this.jwtService.verify(refreshToken);
      const user = await this.userService.findById(decoded.sub);

      if (!user || !user.isActive) {
        throw new Error('Invalid refresh token');
      }

      // Generate new access token
      const payload = {
        sub: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      };

      const newAccessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
      const newRefreshToken = this.jwtService.sign(payload, {
        expiresIn: '7d',
      });

      // Update session
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);

      await this.userService.createSession(user.id, newAccessToken, newRefreshToken, expiresAt);

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        expires_in: 3600,
      };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Logout user
   */
  async logout(accessToken: string) {
    try {
      await this.userService.deleteSession(accessToken);
      return { message: 'Logged out successfully' };
    } catch (error) {
      // Session might not exist, which is fine
      return { message: 'Logged out successfully' };
    }
  }

  /**
   * Validate JWT token and return user
   */
  async validateToken(accessToken: string) {
    try {
      const session = await this.userService.findSessionByAccessToken(accessToken);

      if (!session) {
        return null;
      }

      // Check if session is expired
      if (session.expiresAt < new Date()) {
        await this.userService.deleteSession(accessToken);
        return null;
      }

      if (!session.user.isActive) {
        return null;
      }

      return session.user;
    } catch (error) {
      return null;
    }
  }
}
