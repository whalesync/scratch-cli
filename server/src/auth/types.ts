import { User as ClerkUser } from '@clerk/backend';
import { Socket } from 'socket.io';
import { UserCluster } from 'src/db/cluster-types';

/**
 * Extended user type that adds some additional metadata to the user object to identify the type
 * of authentication used along with packaging in any special clerk data like organizations or name.
 */
export type AuthenticatedUser = UserCluster.User & {
  authType: 'api-token' | 'jwt';
  authSource: 'user' | 'agent';
  clerkUser?: ClerkUser;
};

// (Chris) I know there is likely a better Typescript way to do this globally for the server but I didn't have time to figure it out yet
export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

export interface SocketWithUser extends Socket {
  user: AuthenticatedUser;
}
