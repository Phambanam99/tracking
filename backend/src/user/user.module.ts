import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserFiltersService } from './user-filters.service';
import { UserCleanupService } from './user-cleanup.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'change-me'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '24h') as any },
      }),
    }),
  ],
  controllers: [UserController],
  providers: [UserService, UserFiltersService, UserCleanupService],
  exports: [UserService, UserFiltersService],
})
export class UserModule { }
