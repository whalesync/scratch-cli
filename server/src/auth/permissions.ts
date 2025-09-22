import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from './types';

export function hasAdminToolsPermission(user: AuthenticatedUser): boolean {
  if (user.role === UserRole.ADMIN && (user.authType === 'jwt' || user.authType === 'api-token')) {
    return true;
  }

  return false;
}
