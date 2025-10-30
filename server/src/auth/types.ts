import { User as ClerkUser } from '@clerk/backend';
import { APIToken } from '@prisma/client';
import { Socket } from 'socket.io';
import { UserCluster } from 'src/db/cluster-types';
import { WSLogger } from 'src/logger';
import { Actor } from 'src/users/types';

/**
 * Extended user type that adds some additional metadata to the user object to identify the type
 * of authentication used along with packaging in any special clerk data like organizations or name.
 */
export type AuthenticatedUser = UserCluster.User & {
  authType: 'api-token' | 'agent-token' | 'jwt';
  authSource: 'user' | 'agent';
  clerkUser?: ClerkUser;
  apiToken?: APIToken;
};

export function toActor(user: AuthenticatedUser): Actor {
  if (!user.organizationId) {
    // TODO (DEV-8628): can be removed once migration to organizations is complete -- just here to warn about potential issues during switchover
    WSLogger.error({
      source: 'auth.toActor',
      message: 'User does not have an organization id',
      userId: user.id,
      authType: user.authType,
      authSource: user.authSource,
    });
  }

  return {
    userId: user.id,
    // TODO (DEV-8628): Once migration to organizations is complete the user.organizationId will not be null and we can remove the fallback
    organizationId: user.organizationId ?? '<empty organization id>',
  };
}

// (Chris) I know there is likely a better Typescript way to do this globally for the server but I didn't have time to figure it out yet
export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

export interface SocketWithUser extends Socket {
  user: AuthenticatedUser;
}

/**
 * Extension to the Clerk JwtPayload type with our custom session fields
 */
export interface ScratchpadJwtPayload {
  sub: string; // clerk user id
  fullName?: string;
  primaryEmail?: string;
}
