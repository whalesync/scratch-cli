import { TokenType, UserRole } from '@prisma/client';
import { UserCluster } from 'src/db/cluster-types';

export class User {
  createdAt: Date;
  updatedAt: Date;
  clerkId: string | null;
  isAdmin: boolean;
  id: string;
  // @deprecated - use agentToken or websocketToken instead
  apiToken?: string;
  // The token for the AI agent to use when talking to the Scratchpad API
  agentToken?: string;
  // The token for the client to use for websockets when connecting to the Scratchpad API
  websocketToken?: string;

  constructor(user: UserCluster.User) {
    this.id = user.id;
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
    this.clerkId = user.clerkId;
    this.isAdmin = user.role === UserRole.ADMIN;

    if (user.apiTokens) {
      // TODO remove the generic token and return the scope specific tokens instead
      // needs to be one once we start generating these tokens properly in the UserService
      this.apiToken = findValidToken(user, TokenType.AGENT);
      this.agentToken = findValidToken(user, TokenType.AGENT);
      this.websocketToken = findValidToken(user, TokenType.AGENT);
      // this.websocketToken = findValidToken(user, TokenType.WEBSOCKET);
    }
  }
}

export function findValidToken(user: UserCluster.User, type: TokenType): string | undefined {
  return user.apiTokens.find((token) => token.expiresAt > new Date() && token.type === type)?.token;
}
