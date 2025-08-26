import { TokenType, UserRole } from '@prisma/client';
import { UserCluster } from 'src/db/cluster-types';

export class User {
  createdAt: Date;
  updatedAt: Date;
  clerkId: string | null;
  isAdmin: boolean;
  id: string;

  // The token for the AI agent to use when talking to the Scratchpad API
  // @deprecated - use agentJwt instead
  agentToken?: string;
  // The token for the client to use for websockets when connecting to the Scratchpad API
  websocketToken?: string;

  // The JWT for the AI agent to use when talking to the Scratchpad API
  agentJwt?: string;

  constructor(user: UserCluster.User, agentJwt: string) {
    this.id = user.id;
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
    this.clerkId = user.clerkId;
    this.isAdmin = user.role === UserRole.ADMIN;

    if (user.apiTokens) {
      this.agentToken = findValidToken(user, TokenType.AGENT);
      this.websocketToken = findValidToken(user, TokenType.AGENT);
    }

    this.agentJwt = agentJwt;
  }
}

export function findValidToken(user: UserCluster.User, type: TokenType): string | undefined {
  return user.apiTokens.find((token) => token.expiresAt > new Date() && token.type === type)?.token;
}
