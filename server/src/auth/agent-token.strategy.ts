import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { HeaderAPIKeyStrategy } from 'passport-headerapikey';

import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { UsersService } from 'src/users/users.service';
import { AuthenticatedUser } from './types';

/**
 * This strategy inspects the request for a special Agent API token, validates it against env variable and extracts a user id from it.
 */
@Injectable()
export class AgentTokenStrategy extends PassportStrategy(HeaderAPIKeyStrategy, 'AGENT_TOKEN_STRATEGY') {
  constructor(
    private readonly userService: UsersService,
    private readonly configService: ScratchpadConfigService,
  ) {
    super(
      {
        header: 'Authorization',
        prefix: 'Agent-Token ',
      },
      false,
    );
  }

  async validate(token: string): Promise<AuthenticatedUser | null> {
    // token consists of two elements separated by a colon, a key and an user ID
    const [key, userId] = token.split(':');

    if (key !== this.configService.getScratchpadAgentAuthToken()) {
      return null;
    }

    const user = await this.userService.findOne(userId);
    if (!user) {
      return null;
    }

    return {
      ...user,
      authType: 'agent-token',
      authSource: 'agent',
    };
  }
}
