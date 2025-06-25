import { UserRole } from '@prisma/client';
import { UserCluster } from 'src/db/cluster-types';

export class User {
  createdAt: Date;
  updatedAt: Date;
  clerkId: string | null;
  isAdmin: boolean;
  id: string;
  apiToken?: string;

  constructor(user: UserCluster.User) {
    this.id = user.id;
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
    this.clerkId = user.clerkId;
    this.isAdmin = user.role === UserRole.ADMIN;

    if (user.apiTokens) {
      this.apiToken = user.apiTokens.find((token) => token.expiresAt > new Date())?.token;
    }
  }
}
