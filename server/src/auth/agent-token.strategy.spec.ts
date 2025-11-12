/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { UserCluster } from 'src/db/cluster-types';
import { UsersService } from 'src/users/users.service';
import { AgentTokenStrategy } from './agent-token.strategy';
import { AuthenticatedUser } from './types';

describe('AgentTokenStrategy', () => {
  let strategy: AgentTokenStrategy;
  let usersService: jest.Mocked<UsersService>;
  let configService: jest.Mocked<ScratchpadConfigService>;

  const VALID_AGENT_KEY = 'secret_agent_key_123';

  const mockUser: UserCluster.User = {
    id: 'user_456',
    clerkId: 'clerk_789',
    name: 'Agent User',
    email: 'agent@example.com',
    organizationId: 'org_123',
    hasBoarded: true,
    customSettings: {},
    apiTokens: [],
  };

  beforeEach(async () => {
    const mockUsersService = {
      findOne: jest.fn(),
    };

    const mockConfigService = {
      getScratchpadAgentAuthToken: jest.fn().mockReturnValue(VALID_AGENT_KEY),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentTokenStrategy,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: ScratchpadConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<AgentTokenStrategy>(AgentTokenStrategy);
    usersService = module.get(UsersService);
    configService = module.get(ScratchpadConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should successfully validate a valid agent token with correct format', async () => {
      const token = `${VALID_AGENT_KEY}:user_456`;
      usersService.findOne.mockResolvedValue(mockUser);

      const result = await strategy.validate(token);

      expect(result).toEqual({
        ...mockUser,
        authType: 'agent-token',
        authSource: 'agent',
      });
      expect(usersService.findOne).toHaveBeenCalledWith('user_456');
      expect(configService.getScratchpadAgentAuthToken).toHaveBeenCalled();
    });

    it('should return null when agent key is invalid', async () => {
      const token = 'invalid_key:user_456';

      const result = await strategy.validate(token);

      expect(result).toBeNull();
      expect(usersService.findOne).not.toHaveBeenCalled();
    });

    it('should return null when user is not found', async () => {
      const token = `${VALID_AGENT_KEY}:nonexistent_user`;
      usersService.findOne.mockResolvedValue(null);

      const result = await strategy.validate(token);

      expect(result).toBeNull();
      expect(usersService.findOne).toHaveBeenCalledWith('nonexistent_user');
    });

    it('should handle token with no colon separator', async () => {
      const token = 'invalid_token_format';

      const result = await strategy.validate(token);

      expect(result).toBeNull();
      expect(usersService.findOne).not.toHaveBeenCalled();
    });

    it('should handle token with multiple colons (uses first as separator)', async () => {
      const token = `${VALID_AGENT_KEY}:user:with:colons`;
      usersService.findOne.mockResolvedValue(null);

      await strategy.validate(token);

      // The split will create ['secret_agent_key_123', 'user', 'with', 'colons']
      // So userId will be 'user' (second element)
      expect(usersService.findOne).toHaveBeenCalledWith('user');
    });

    it('should handle empty key part', async () => {
      const token = ':user_456';

      const result = await strategy.validate(token);

      expect(result).toBeNull();
    });

    it('should handle empty user ID part', async () => {
      const token = `${VALID_AGENT_KEY}:`;
      usersService.findOne.mockResolvedValue(null);

      await strategy.validate(token);

      expect(usersService.findOne).toHaveBeenCalledWith('');
    });

    it('should handle user without organization ID', async () => {
      const userWithoutOrg: UserCluster.User = {
        ...mockUser,
        organizationId: null,
      };

      const token = `${VALID_AGENT_KEY}:user_456`;
      usersService.findOne.mockResolvedValue(userWithoutOrg);

      const result = await strategy.validate(token);

      expect(result).toEqual({
        ...userWithoutOrg,
        authType: 'agent-token',
        authSource: 'agent',
      });
    });

    it('should handle different user IDs correctly', async () => {
      const token = `${VALID_AGENT_KEY}:user_999`;
      const differentUser: UserCluster.User = {
        ...mockUser,
        id: 'user_999',
        name: 'Different User',
        email: 'different@example.com',
      };

      usersService.findOne.mockResolvedValue(differentUser);

      const result = await strategy.validate(token);

      expect(result).toEqual({
        ...differentUser,
        authType: 'agent-token',
        authSource: 'agent',
      });
      expect(usersService.findOne).toHaveBeenCalledWith('user_999');
    });

    it('should validate auth type and source are set correctly', async () => {
      const token = `${VALID_AGENT_KEY}:user_456`;
      usersService.findOne.mockResolvedValue(mockUser);

      const result = (await strategy.validate(token)) as AuthenticatedUser;

      expect(result.authType).toBe('agent-token');
      expect(result.authSource).toBe('agent');
    });

    it('should handle database errors gracefully', async () => {
      const token = `${VALID_AGENT_KEY}:user_456`;
      usersService.findOne.mockRejectedValue(new Error('Database connection failed'));

      await expect(strategy.validate(token)).rejects.toThrow('Database connection failed');
    });

    it('should handle special characters in user ID', async () => {
      const token = `${VALID_AGENT_KEY}:user_with-special.chars_123`;
      usersService.findOne.mockResolvedValue(null);

      await strategy.validate(token);

      expect(usersService.findOne).toHaveBeenCalledWith('user_with-special.chars_123');
    });

    it('should handle very long user IDs', async () => {
      const longUserId = 'user_' + 'a'.repeat(500);
      const token = `${VALID_AGENT_KEY}:${longUserId}`;
      usersService.findOne.mockResolvedValue(null);

      await strategy.validate(token);

      expect(usersService.findOne).toHaveBeenCalledWith(longUserId);
    });

    it('should preserve all user fields in authenticated user response', async () => {
      const userWithCustomSettings: UserCluster.User = {
        ...mockUser,
        hasBoarded: false,
        customSettings: { agentMode: true, version: 2 },
      };

      const token = `${VALID_AGENT_KEY}:user_456`;
      usersService.findOne.mockResolvedValue(userWithCustomSettings);

      const result = (await strategy.validate(token)) as AuthenticatedUser;

      expect(result.hasBoarded).toBe(false);
      expect(result.customSettings).toEqual({ agentMode: true, version: 2 });
      expect(result.authType).toBe('agent-token');
      expect(result.authSource).toBe('agent');
    });

    it('should handle whitespace in token parts', async () => {
      const token = `${VALID_AGENT_KEY}: user_456`;
      usersService.findOne.mockResolvedValue(null);

      await strategy.validate(token);

      // The userId will include the leading space
      expect(usersService.findOne).toHaveBeenCalledWith(' user_456');
    });
  });
});
