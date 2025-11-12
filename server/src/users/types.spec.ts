import { UserCluster } from 'src/db/cluster-types';
import { WSLogger } from 'src/logger';
import { userToActor } from './types';

describe('User Type Utilities', () => {
  describe('userToActor', () => {
    let loggerErrorSpy: jest.SpyInstance;

    afterEach(() => {
      // Restore WSLogger.error if it was spied on
      if (loggerErrorSpy) {
        loggerErrorSpy.mockRestore();
      }
    });

    it('should convert user to actor with organization id', () => {
      const user: UserCluster.User = {
        id: 'user_123',
        clerkId: 'clerk_456',
        organizationId: 'org_789',
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@example.com',
        name: 'Test User',
        hasOnboarded: true,
        settings: {},
        profileImageUrl: null,
      };

      const actor = userToActor(user);

      expect(actor).toEqual({
        userId: 'user_123',
        organizationId: 'org_789',
      });
    });

    it('should handle user with null organization id with fallback', () => {
      // Suppress expected error logs from WSLogger
      loggerErrorSpy = jest.spyOn(WSLogger, 'error').mockImplementation();

      const user: UserCluster.User = {
        id: 'user_123',
        clerkId: 'clerk_456',
        organizationId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@example.com',
        name: 'Test User',
        hasOnboarded: true,
        settings: {},
        profileImageUrl: null,
      };

      const actor = userToActor(user);

      expect(actor.userId).toBe('user_123');
      expect(actor.organizationId).toBe('<empty org id>');
    });

    it('should handle user with undefined organization id with fallback', () => {
      // Suppress expected error logs from WSLogger
      loggerErrorSpy = jest.spyOn(WSLogger, 'error').mockImplementation();

      const user: UserCluster.User = {
        id: 'user_123',
        clerkId: 'clerk_456',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        organizationId: undefined as any,
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@example.com',
        name: 'Test User',
        hasOnboarded: true,
        settings: {},
        profileImageUrl: null,
      };

      const actor = userToActor(user);

      expect(actor.userId).toBe('user_123');
      expect(actor.organizationId).toBe('<empty org id>');
    });

    it('should preserve user id exactly as provided', () => {
      const userId = 'very-long-user-id-with-special-chars_123-456';
      const user: UserCluster.User = {
        id: userId,
        clerkId: 'clerk_456',
        organizationId: 'org_789',
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@example.com',
        name: 'Test User',
        hasOnboarded: true,
        settings: {},
        profileImageUrl: null,
      };

      const actor = userToActor(user);

      expect(actor.userId).toBe(userId);
    });

    it('should preserve organization id exactly as provided', () => {
      const orgId = 'very-long-org-id-with-special-chars_789-abc';
      const user: UserCluster.User = {
        id: 'user_123',
        clerkId: 'clerk_456',
        organizationId: orgId,
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@example.com',
        name: 'Test User',
        hasOnboarded: true,
        settings: {},
        profileImageUrl: null,
      };

      const actor = userToActor(user);

      expect(actor.organizationId).toBe(orgId);
    });

    it('should handle user with all optional fields', () => {
      const user: UserCluster.User = {
        id: 'user_123',
        clerkId: 'clerk_456',
        organizationId: 'org_789',
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@example.com',
        name: 'Test User',
        hasOnboarded: true,
        settings: {},
        profileImageUrl: null,
      };

      const actor = userToActor(user);

      expect(actor).toBeDefined();
      expect(actor.userId).toBe('user_123');
      expect(actor.organizationId).toBe('org_789');
    });

    it('should handle user with custom settings', () => {
      const user: UserCluster.User = {
        id: 'user_123',
        clerkId: 'clerk_456',
        organizationId: 'org_789',
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@example.com',
        name: 'Test User',
        hasOnboarded: true,
        settings: { theme: 'dark', language: 'en' },
        profileImageUrl: 'https://example.com/avatar.jpg',
      };

      const actor = userToActor(user);

      expect(actor.userId).toBe('user_123');
      expect(actor.organizationId).toBe('org_789');
    });

    it('should handle user who has not onboarded', () => {
      const user: UserCluster.User = {
        id: 'user_123',
        clerkId: 'clerk_456',
        organizationId: 'org_789',
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@example.com',
        name: 'Test User',
        hasOnboarded: false,
        settings: {},
        profileImageUrl: null,
      };

      const actor = userToActor(user);

      expect(actor.userId).toBe('user_123');
      expect(actor.organizationId).toBe('org_789');
    });

    it('should create actor with only userId and organizationId fields', () => {
      const user: UserCluster.User = {
        id: 'user_123',
        clerkId: 'clerk_456',
        organizationId: 'org_789',
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@example.com',
        name: 'Test User',
        hasOnboarded: true,
        settings: {},
        profileImageUrl: null,
      };

      const actor = userToActor(user);

      expect(Object.keys(actor)).toEqual(['userId', 'organizationId']);
    });

    it('should not include any user metadata in actor', () => {
      const user: UserCluster.User = {
        id: 'user_123',
        clerkId: 'clerk_456',
        organizationId: 'org_789',
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'secret@example.com',
        name: 'Secret User',
        hasOnboarded: true,
        settings: { secret: 'data' },
        profileImageUrl: 'https://example.com/secret.jpg',
      };

      const actor = userToActor(user);

      expect(actor).not.toHaveProperty('email');
      expect(actor).not.toHaveProperty('name');
      expect(actor).not.toHaveProperty('settings');
      expect(actor).not.toHaveProperty('profileImageUrl');
      expect(actor).not.toHaveProperty('clerkId');
      expect(actor).not.toHaveProperty('createdAt');
      expect(actor).not.toHaveProperty('updatedAt');
      expect(actor).not.toHaveProperty('hasOnboarded');
    });
  });
});
