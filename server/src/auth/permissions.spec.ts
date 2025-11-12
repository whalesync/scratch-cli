import { UserRole } from '@prisma/client';
import { UserId } from 'src/types/ids';
import { hasAdminToolsPermission } from './permissions';
import { AuthenticatedUser } from './types';

describe('permissions', () => {
  describe('hasAdminToolsPermission', () => {
    // Helper to create test users
    const createTestUser = (
      role: UserRole,
      authType: AuthenticatedUser['authType'],
      authSource: AuthenticatedUser['authSource'] = 'user',
    ): AuthenticatedUser => ({
      id: 'user_123' as UserId,
      createdAt: new Date(),
      updatedAt: new Date(),
      clerkId: 'clerk_123',
      name: 'Test User',
      email: 'test@example.com',
      role,
      authType,
      authSource,
      stripeCustomerId: null,
      organizationId: 'org_123',
      refCode: null,
      firstTimeUser: false,
    });

    describe('ADMIN users', () => {
      it('should return true for ADMIN with jwt auth', () => {
        const user = createTestUser(UserRole.ADMIN, 'jwt');
        expect(hasAdminToolsPermission(user)).toBe(true);
      });

      it('should return true for ADMIN with api-token auth', () => {
        const user = createTestUser(UserRole.ADMIN, 'api-token');
        expect(hasAdminToolsPermission(user)).toBe(true);
      });

      it('should return false for ADMIN with agent-token auth', () => {
        const user = createTestUser(UserRole.ADMIN, 'agent-token');
        expect(hasAdminToolsPermission(user)).toBe(false);
      });

      it('should return true for ADMIN with jwt and agent authSource', () => {
        const user = createTestUser(UserRole.ADMIN, 'jwt', 'agent');
        expect(hasAdminToolsPermission(user)).toBe(true);
      });
    });

    describe('USER role (non-admin)', () => {
      it('should return false for USER with jwt auth', () => {
        const user = createTestUser(UserRole.USER, 'jwt');
        expect(hasAdminToolsPermission(user)).toBe(false);
      });

      it('should return false for USER with api-token auth', () => {
        const user = createTestUser(UserRole.USER, 'api-token');
        expect(hasAdminToolsPermission(user)).toBe(false);
      });

      it('should return false for USER with agent-token auth', () => {
        const user = createTestUser(UserRole.USER, 'agent-token');
        expect(hasAdminToolsPermission(user)).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle user with no organization id', () => {
        const user = createTestUser(UserRole.ADMIN, 'jwt');
        user.organizationId = null;
        expect(hasAdminToolsPermission(user)).toBe(true);
      });

      it('should handle user with missing clerk id', () => {
        const user = createTestUser(UserRole.ADMIN, 'jwt');
        user.clerkId = null;
        expect(hasAdminToolsPermission(user)).toBe(true);
      });

      it('should handle user with missing name and email', () => {
        const user = createTestUser(UserRole.ADMIN, 'api-token');
        user.name = null;
        user.email = null;
        expect(hasAdminToolsPermission(user)).toBe(true);
      });
    });

    describe('auth combinations', () => {
      // Test all combinations for completeness
      const testCases: Array<{
        role: UserRole;
        authType: AuthenticatedUser['authType'];
        expected: boolean;
        description: string;
      }> = [
        { role: UserRole.ADMIN, authType: 'jwt', expected: true, description: 'ADMIN + jwt' },
        { role: UserRole.ADMIN, authType: 'api-token', expected: true, description: 'ADMIN + api-token' },
        { role: UserRole.ADMIN, authType: 'agent-token', expected: false, description: 'ADMIN + agent-token' },
        { role: UserRole.USER, authType: 'jwt', expected: false, description: 'USER + jwt' },
        { role: UserRole.USER, authType: 'api-token', expected: false, description: 'USER + api-token' },
        { role: UserRole.USER, authType: 'agent-token', expected: false, description: 'USER + agent-token' },
      ];

      testCases.forEach(({ role, authType, expected, description }) => {
        it(`should return ${expected} for ${description}`, () => {
          const user = createTestUser(role, authType);
          expect(hasAdminToolsPermission(user)).toBe(expected);
        });
      });
    });
  });
});
