import { User as ClerkUser } from '@clerk/backend';
import { APIToken } from '@prisma/client';
import { Socket } from 'socket.io';
import { UserCluster } from 'src/db/cluster-types';

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

/**
 * Connector credentials passed via the X-Scratch-Connector header for CLI requests.
 * This allows CLI tools to provide connection details for data sources.
 */
export interface CliConnectorCredentials {
  service: string;
  params?: Record<string, string>;
}

/**
 * Extended Express Request type for CLI endpoints that may include optional connector credentials
 * parsed from the X-Scratch-Connector header.
 */
export interface CliRequest {
  connectorCredentials?: CliConnectorCredentials;
}
