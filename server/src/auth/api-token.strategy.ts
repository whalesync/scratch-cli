import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { User } from '@prisma/client';
import { HeaderAPIKeyStrategy } from 'passport-headerapikey';

import { UsersService } from 'src/users/users.service';

/**
 * This strategy inspects the request for a Whalesync API Token and validates it against the database.
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

  async validate(token: string): Promise<User | null> {
    const user = await this.userService.getUserFromAPIToken(token);
    return user;
  }
}
