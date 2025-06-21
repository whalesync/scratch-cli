import { User as ClerkUser } from '@clerk/backend';
import { Injectable } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { createUserId } from 'src/types/ids';
import { DbService } from '../db/db.service';

@Injectable()
export class UsersService {
  constructor(private readonly db: DbService) {}

  public async findOne(id: string): Promise<User | null> {
    return this.db.client.user.findUnique({ where: { id } });
  }

  public async findByClerkId(clerkId: string): Promise<User | null> {
    return this.db.client.user.findFirst({ where: { clerkId } });
  }

  public async getUserFromAPIToken(apiToken: string): Promise<User | null> {
    return this.db.client.user.findFirst({
      where: { apiTokens: { some: { token: apiToken, expiresAt: { gt: new Date() } } } },
    });
  }

  public async getOrCreateUserFromClerk(clerkUser: ClerkUser): Promise<User | null> {
    const user = await this.findByClerkId(clerkUser.id);

    if (user) {
      return user;
    }

    const newUser = await this.db.client.user.create({
      data: {
        id: createUserId(),
        clerkId: clerkUser.id,
        updatedAt: new Date(),
        role: UserRole.USER,
      },
    });

    return newUser;
  }
}
