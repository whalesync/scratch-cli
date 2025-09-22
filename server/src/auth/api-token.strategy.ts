import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { HeaderAPIKeyStrategy } from 'passport-headerapikey';

import { WSLogger } from 'src/logger';
import { UsersService } from 'src/users/users.service';
import { AuthenticatedUser } from './types';

/**
 * This strategy inspects the request for a User scoped API Token and validates it against the database.
 */
@Injectable()
export class APITokenStrategy extends PassportStrategy(HeaderAPIKeyStrategy, 'API_TOKEN_STRATEGY') {
  constructor(private readonly userService: UsersService) {
    super(
      {
        header: 'Authorization',
        prefix: 'API-Token ',
      },
      false,
    );
  }

  async validate(token: string): Promise<AuthenticatedUser | null> {
    const user = await this.userService.getUserFromAPIToken(token);

    if (!user) {
      return null;
    }

    const tokenUsed = user.apiTokens.find((option) => option.token === token);

    if (!tokenUsed) {
      // something went very wrong if we can't find the same token that we used to find the user
      WSLogger.error({
        source: 'APITokenStrategy',
        message: "Token used to find user not found in user's api tokens",
        token,
        user,
      });
      return null;
    }

    return {
      ...user,
      authType: 'api-token',
      authSource: 'user',
      apiToken: tokenUsed,
    };
  }
}
