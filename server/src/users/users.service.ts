import { User as ClerkUser } from '@clerk/backend';
import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UserCluster } from 'src/db/cluster-types';
import { createUserId } from 'src/types/ids';
import { DbService } from '../db/db.service';

@Injectable()
export class UsersService {
  constructor(private readonly db: DbService) {}

  public async findOne(id: string): Promise<UserCluster.User | null> {
    return this.db.client.user.findUnique({ where: { id }, include: UserCluster._validator.include });
  }

  public async findByClerkId(clerkId: string): Promise<UserCluster.User | null> {
    return this.db.client.user.findFirst({ where: { clerkId }, include: UserCluster._validator.include });
  }

  public async getUserFromAPIToken(apiToken: string): Promise<UserCluster.User | null> {
    return this.db.client.user.findFirst({
      where: {
        apiTokens: { some: { token: apiToken, expiresAt: { gt: new Date() } } },
      },
      include: UserCluster._validator.include,
    });
  }

  public async getOrCreateUserFromClerk(clerkUser: ClerkUser): Promise<UserCluster.User | null> {
    const user = await this.findByClerkId(clerkUser.id);

    if (user) {
      // if (user.apiTokens.length === 0) {
      //   const newToken = await this.db.client.aPIToken.create({
      //     data: {
      //       token: createApiToken(),
      //       userId: user.id,
      //     },
      //   });
      // }

      return user;
    }

    const newUser = await this.db.client.user.create({
      data: {
        id: createUserId(),
        clerkId: clerkUser.id,
        updatedAt: new Date(),
        role: UserRole.USER,
      },
      include: UserCluster._validator.include,
    });

    return newUser;
  }
}
