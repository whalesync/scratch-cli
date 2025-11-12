import { WSLogger } from 'src/logger';
import { AuthenticatedUser, toActor } from './types';

describe('Auth Type Utilities', () => {
  describe('toActor', () => {
    let loggerErrorSpy: jest.SpyInstance;

    afterEach(() => {
      // Restore WSLogger.error if it was spied on
      if (loggerErrorSpy) {
        loggerErrorSpy.mockRestore();
      }
    });

    it('should convert authenticated user to actor with organization id', () => {
      const user: AuthenticatedUser = {
        id: 'user_123',
        clerkId: 'clerk_456',
        organizationId: 'org_789',
        authType: 'jwt',
        authSource: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@example.com',
        name: 'Test User',
        hasOnboarded: true,
        settings: {},
        profileImageUrl: null,
      };

      const actor = toActor(user);

      expect(actor).toEqual({
        userId: 'user_123',
        organizationId: 'org_789',
      });
    });

    it('should handle user with jwt auth type', () => {
      const user: AuthenticatedUser = {
        id: 'user_123',
        clerkId: 'clerk_456',
        organizationId: 'org_789',
        authType: 'jwt',
        authSource: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@example.com',
        name: 'Test User',
        hasOnboarded: true,
        settings: {},
        profileImageUrl: null,
      };

      const actor = toActor(user);

      expect(actor.userId).toBe('user_123');
      expect(actor.organizationId).toBe('org_789');
    });

    it('should handle user with api-token auth type', () => {
      const user: AuthenticatedUser = {
        id: 'user_456',
        clerkId: 'clerk_789',
        organizationId: 'org_abc',
        authType: 'api-token',
        authSource: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'api@example.com',
        name: 'API User',
        hasOnboarded: true,
        settings: {},
        profileImageUrl: null,
      };

      const actor = toActor(user);

      expect(actor.userId).toBe('user_456');
      expect(actor.organizationId).toBe('org_abc');
    });

    it('should handle user with agent-token auth type', () => {
      const user: AuthenticatedUser = {
        id: 'user_789',
        clerkId: 'clerk_abc',
        organizationId: 'org_def',
        authType: 'agent-token',
        authSource: 'agent',
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'agent@example.com',
        name: 'Agent User',
        hasOnboarded: true,
        settings: {},
        profileImageUrl: null,
      };

      const actor = toActor(user);

      expect(actor.userId).toBe('user_789');
      expect(actor.organizationId).toBe('org_def');
    });

    it('should handle user with null organization id with fallback', () => {
      // Suppress expected error logs from WSLogger
      loggerErrorSpy = jest.spyOn(WSLogger, 'error').mockImplementation();

      const user: AuthenticatedUser = {
        id: 'user_123',
        clerkId: 'clerk_456',
        organizationId: null,
        authType: 'jwt',
        authSource: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@example.com',
        name: 'Test User',
        hasOnboarded: true,
        settings: {},
        profileImageUrl: null,
      };

      const actor = toActor(user);

      expect(actor.userId).toBe('user_123');
      expect(actor.organizationId).toBe('<empty org id>');
    });

    it('should handle user with undefined organization id with fallback', () => {
      // Suppress expected error logs from WSLogger
      loggerErrorSpy = jest.spyOn(WSLogger, 'error').mockImplementation();

      const user: AuthenticatedUser = {
        id: 'user_123',
        clerkId: 'clerk_456',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        organizationId: undefined as any,
        authType: 'jwt',
        authSource: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@example.com',
        name: 'Test User',
        hasOnboarded: true,
        settings: {},
        profileImageUrl: null,
      };

      const actor = toActor(user);

      expect(actor.userId).toBe('user_123');
      expect(actor.organizationId).toBe('<empty org id>');
    });

    it('should handle user from user auth source', () => {
      const user: AuthenticatedUser = {
        id: 'user_123',
        clerkId: 'clerk_456',
        organizationId: 'org_789',
        authType: 'jwt',
        authSource: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@example.com',
        name: 'Test User',
        hasOnboarded: true,
        settings: {},
        profileImageUrl: null,
      };

      const actor = toActor(user);

      expect(actor).toBeDefined();
      expect(actor.userId).toBe('user_123');
    });

    it('should handle user from agent auth source', () => {
      const user: AuthenticatedUser = {
        id: 'user_789',
        clerkId: 'clerk_abc',
        organizationId: 'org_def',
        authType: 'agent-token',
        authSource: 'agent',
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'agent@example.com',
        name: 'Agent User',
        hasOnboarded: true,
        settings: {},
        profileImageUrl: null,
      };

      const actor = toActor(user);

      expect(actor).toBeDefined();
      expect(actor.userId).toBe('user_789');
    });

    it('should preserve user id exactly as provided', () => {
      const userId = 'very-long-user-id-with-special-chars_123-456';
      const user: AuthenticatedUser = {
        id: userId,
        clerkId: 'clerk_456',
        organizationId: 'org_789',
        authType: 'jwt',
        authSource: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@example.com',
        name: 'Test User',
        hasOnboarded: true,
        settings: {},
        profileImageUrl: null,
      };

      const actor = toActor(user);

      expect(actor.userId).toBe(userId);
    });

    it('should preserve organization id exactly as provided', () => {
      const orgId = 'very-long-org-id-with-special-chars_789-abc';
      const user: AuthenticatedUser = {
        id: 'user_123',
        clerkId: 'clerk_456',
        organizationId: orgId,
        authType: 'jwt',
        authSource: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@example.com',
        name: 'Test User',
        hasOnboarded: true,
        settings: {},
        profileImageUrl: null,
      };

      const actor = toActor(user);

      expect(actor.organizationId).toBe(orgId);
    });
  });
});
