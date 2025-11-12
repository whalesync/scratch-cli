/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { APIToken } from '@prisma/client';
import { UserCluster } from 'src/db/cluster-types';
import { WSLogger } from 'src/logger';
import { UsersService } from 'src/users/users.service';
import { APITokenStrategy } from './api-token.strategy';
import { AuthenticatedUser } from './types';

describe('APITokenStrategy', () => {
  let strategy: APITokenStrategy;
  let usersService: jest.Mocked<UsersService>;
  let loggerErrorSpy: jest.SpyInstance;

  const mockUser: UserCluster.User = {
    id: 'user_123',
    clerkId: 'clerk_456',
    name: 'Test User',
    email: 'test@example.com',
    organizationId: 'org_789',
    hasBoarded: true,
    customSettings: {},
    apiTokens: [
      {
        id: 'token_1',
        userId: 'user_123',
        token: 'valid_api_token_123',
        description: 'Test API Token',
        expiresAt: new Date(Date.now() + 86400000), // 1 day from now
        createdAt: new Date(),
      },
      {
        id: 'token_2',
        userId: 'user_123',
        token: 'another_valid_token_456',
        description: 'Another API Token',
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
      },
    ] as APIToken[],
  };

  beforeEach(async () => {
    const mockUsersService = {
      getUserFromAPIToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        APITokenStrategy,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    strategy = module.get<APITokenStrategy>(APITokenStrategy);
    usersService = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Restore WSLogger.error if it was spied on
    if (loggerErrorSpy) {
      loggerErrorSpy.mockRestore();
    }
  });

  describe('validate', () => {
    it('should successfully validate a valid API token and return authenticated user', async () => {
      usersService.getUserFromAPIToken.mockResolvedValue(mockUser);

      const result = await strategy.validate('valid_api_token_123');

      expect(result).toEqual({
        ...mockUser,
        authType: 'api-token',
        authSource: 'user',
        apiToken: mockUser.apiTokens[0],
      });
      expect(usersService.getUserFromAPIToken).toHaveBeenCalledWith('valid_api_token_123');
    });

    it('should return authenticated user with correct token when user has multiple API tokens', async () => {
      usersService.getUserFromAPIToken.mockResolvedValue(mockUser);

      const result = await strategy.validate('another_valid_token_456');

      expect(result).toEqual({
        ...mockUser,
        authType: 'api-token',
        authSource: 'user',
        apiToken: mockUser.apiTokens[1],
      });
      expect(usersService.getUserFromAPIToken).toHaveBeenCalledWith('another_valid_token_456');
    });

    it('should return null when user is not found for given token', async () => {
      usersService.getUserFromAPIToken.mockResolvedValue(null);

      const result = await strategy.validate('invalid_token');

      expect(result).toBeNull();
      expect(usersService.getUserFromAPIToken).toHaveBeenCalledWith('invalid_token');
    });

    it('should return null when token does not match any of user tokens (edge case)', async () => {
      // Suppress expected error logs from WSLogger
      loggerErrorSpy = jest.spyOn(WSLogger, 'error').mockImplementation();

      const userWithDifferentTokens: UserCluster.User = {
        ...mockUser,
        apiTokens: [
          {
            id: 'token_3',
            userId: 'user_123',
            token: 'different_token',
            description: 'Different Token',
            expiresAt: new Date(Date.now() + 86400000),
            createdAt: new Date(),
          },
        ] as APIToken[],
      };

      usersService.getUserFromAPIToken.mockResolvedValue(userWithDifferentTokens);

      const result = await strategy.validate('valid_api_token_123');

      expect(result).toBeNull();
    });

    it('should handle user with empty apiTokens array', async () => {
      // Suppress expected error logs from WSLogger
      loggerErrorSpy = jest.spyOn(WSLogger, 'error').mockImplementation();

      const userWithNoTokens: UserCluster.User = {
        ...mockUser,
        apiTokens: [],
      };

      usersService.getUserFromAPIToken.mockResolvedValue(userWithNoTokens);

      const result = await strategy.validate('some_token');

      expect(result).toBeNull();
    });

    it('should handle expired tokens (token lookup works but expired)', async () => {
      const userWithExpiredToken: UserCluster.User = {
        ...mockUser,
        apiTokens: [
          {
            id: 'token_1',
            userId: 'user_123',
            token: 'expired_token',
            description: 'Expired Token',
            expiresAt: new Date(Date.now() - 86400000), // 1 day ago
            createdAt: new Date(),
          },
        ] as APIToken[],
      };

      usersService.getUserFromAPIToken.mockResolvedValue(userWithExpiredToken);

      const result = await strategy.validate('expired_token');

      expect(result).toEqual({
        ...userWithExpiredToken,
        authType: 'api-token',
        authSource: 'user',
        apiToken: userWithExpiredToken.apiTokens[0],
      });
    });

    it('should handle user without organization ID', async () => {
      const userWithoutOrg: UserCluster.User = {
        ...mockUser,
        organizationId: null,
      };

      usersService.getUserFromAPIToken.mockResolvedValue(userWithoutOrg);

      const result = await strategy.validate('valid_api_token_123');

      expect(result).toEqual({
        ...userWithoutOrg,
        authType: 'api-token',
        authSource: 'user',
        apiToken: userWithoutOrg.apiTokens[0],
      });
    });

    it('should handle database errors gracefully', async () => {
      usersService.getUserFromAPIToken.mockRejectedValue(new Error('Database connection failed'));

      await expect(strategy.validate('valid_api_token_123')).rejects.toThrow('Database connection failed');
    });

    it('should handle long token strings', async () => {
      const longToken = 'a'.repeat(500);
      usersService.getUserFromAPIToken.mockResolvedValue(null);

      const result = await strategy.validate(longToken);

      expect(result).toBeNull();
      expect(usersService.getUserFromAPIToken).toHaveBeenCalledWith(longToken);
    });

    it('should handle special characters in tokens', async () => {
      const specialToken = 'token-with_special.chars!@#$%';
      usersService.getUserFromAPIToken.mockResolvedValue(null);

      const result = await strategy.validate(specialToken);

      expect(result).toBeNull();
      expect(usersService.getUserFromAPIToken).toHaveBeenCalledWith(specialToken);
    });

    it('should preserve all user fields in authenticated user response', async () => {
      const userWithCustomSettings: UserCluster.User = {
        ...mockUser,
        hasBoarded: false,
        customSettings: { theme: 'dark', language: 'en' },
      };

      usersService.getUserFromAPIToken.mockResolvedValue(userWithCustomSettings);

      const result = (await strategy.validate('valid_api_token_123')) as AuthenticatedUser;

      expect(result.hasBoarded).toBe(false);
      expect(result.customSettings).toEqual({ theme: 'dark', language: 'en' });
      expect(result.authType).toBe('api-token');
      expect(result.authSource).toBe('user');
    });
  });
});
