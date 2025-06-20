import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { User } from '@prisma/client';
import { HeaderAPIKeyStrategy } from 'passport-headerapikey';

import { DbService } from 'src/db/db.service';

/**
 * This strategy inspects the request for a Whalesync API Token and validates it against the database.
 */
@Injectable()
export class APITokenStrategy extends PassportStrategy(HeaderAPIKeyStrategy, 'API_TOKEN_STRATEGY') {
  constructor(private readonly dbService: DbService) {
    super(
      {
        header: 'Authorization',
        prefix: 'API-Token ',
      },
      false,
    );
  }

  async validate(token: string): Promise<User | null> {
    // return await this.findUserForToken(token);
    return null;
  }
}
