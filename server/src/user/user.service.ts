import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { DbService } from '../db/db.service';

@Injectable()
export class UserService {
  constructor(private readonly db: DbService) {}

  public async findOne(id: string): Promise<User> {
    return this.db.client.user.findUniqueOrThrow({ where: { id } });
  }
}
