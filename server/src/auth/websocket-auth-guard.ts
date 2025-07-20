import { ClerkClient, verifyToken } from '@clerk/backend';
import { TokenVerificationError } from '@clerk/backend/errors';
import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { WSLogger } from 'src/logger';
import { UsersService } from 'src/users/users.service';
import { AuthenticatedUser, SocketWithUser } from './types';

@Injectable()
export class WebSocketAuthGuard implements CanActivate {
  constructor(
    @Inject('ClerkClient')
    private readonly clerkClient: ClerkClient,
    private readonly configService: ScratchpadConfigService,
    private readonly userService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: SocketWithUser = context.switchToWs().getClient<SocketWithUser>();

    // 1. Extract the token from the handshake
    const token = client.handshake.auth?.token as string;

    if (!token) {
      WSLogger.error({ source: 'WsAuthGuard', message: 'No authentication token provided' });
      throw new WsException('Unauthorized: No token provided.');
    }

    // 2. First try API token authentication
    const apiTokenUser = await this.validateAPIToken(token);
    if (apiTokenUser) {
      client.user = apiTokenUser;
      return true;
    }

    // 3. Fall back to JWT authentication
    const jwtUser = await this.validateJWT(token);
    if (jwtUser) {
      client.user = jwtUser;
      return true;
    }

    // 4. If both fail, throw unauthorized
    WSLogger.error({ source: 'WsAuthGuard', message: 'Invalid authentication token' });
    throw new WsException('Unauthorized: Invalid token.');
  }

  private async validateAPIToken(token: string): Promise<AuthenticatedUser | null> {
    try {
      const user = await this.userService.getUserFromAPIToken(token);

      if (!user) {
        return null;
      }

      return {
        ...user,
        authType: 'api-token',
        authSource: 'agent',
      };
    } catch (error) {
      WSLogger.error({
        source: 'WsAuthGuard',
        message: 'API token validation error',
        error,
      });
      return null;
    }
  }

  private async validateJWT(token: string): Promise<AuthenticatedUser | null> {
    try {
      const tokenPayload = await verifyToken(token, {
        secretKey: this.configService.getClerkSecretKey(),
      });

      const clerkUser = await this.clerkClient.users.getUser(tokenPayload.sub);

      if (!clerkUser) {
        return null;
      }

      const user = await this.userService.getOrCreateUserFromClerk(clerkUser);

      if (!user) {
        return null;
      }

      return {
        ...user,
        authType: 'jwt',
        authSource: 'user',
        clerkUser,
      };
    } catch (error) {
      if (error instanceof TokenVerificationError) {
        WSLogger.error({
          source: 'WsAuthGuard',
          message: 'JWT token failed to verify',
          reason: error.reason,
          action: error.action,
        });
      } else {
        WSLogger.error({
          source: 'WsAuthGuard',
          message: 'JWT token validation error',
          error,
        });
      }
      return null;
    }
  }
}
