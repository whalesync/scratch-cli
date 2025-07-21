import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { nanoid } from 'nanoid';
import { UserCluster } from 'src/db/cluster-types';
import { createApiTokenId, createUserId } from 'src/types/ids';
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

  public async getOrCreateUserFromClerk(clerkUserId: string): Promise<UserCluster.User | null> {
    const user = await this.findByClerkId(clerkUserId);

    if (user) {
      // make sure the user has an api token
      if (user.apiTokens.length === 0) {
        const newToken = await this.db.client.aPIToken.create({
          data: {
            id: createApiTokenId(),
            userId: user.id,
            token: this.generateApiToken(),
            expiresAt: this.generateTokenExpirationDate(),
          },
        });

        return {
          ...user,
          apiTokens: [...user.apiTokens, newToken],
        };
      }

      return user;
    }

    const newUser = await this.db.client.user.create({
      data: {
        id: createUserId(),
        clerkId: clerkUserId,
        updatedAt: new Date(),
        role: UserRole.USER,
        apiTokens: {
          create: {
            id: createApiTokenId(),
            token: this.generateApiToken(),
            expiresAt: this.generateTokenExpirationDate(),
          },
        },
      },
      include: UserCluster._validator.include,
    });

    return newUser;
  }

  private generateApiToken(): string {
    // Generate a secure 32-character token using nanoid
    return nanoid(32);
  }

  private generateTokenExpirationDate(): Date {
    // set to 6 months from now
    return new Date(Date.now() + 1000 * 60 * 60 * 24 * 180); // 6 months
  }
}
