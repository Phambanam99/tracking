import { SetMetadata } from '@nestjs/common';

// Define UserRole enum since Prisma client may not export it yet
export enum UserRole {
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
  USER = 'USER',
  VIEWER = 'VIEWER',
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// Public decorator to mark endpoints as public (skip authentication)
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
