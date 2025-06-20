import { Injectable } from '@nestjs/common';

import { DbService } from '../db/db.service';
import { User } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private readonly db: DbService) {}

  public async findOne(id: string): Promise<User> {
    return this.db.client.user.findUniqueOrThrow({ where: { id } });
  }
}
