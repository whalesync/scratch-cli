import { ClerkClient, verifyToken } from '@clerk/backend';
import { TokenVerificationError } from '@clerk/backend/errors';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-custom';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { WSLogger } from 'src/logger';
import { UsersService } from 'src/users/users.service';
import { AuthenticatedUser, ScratchpadJwtPayload } from './types';

@Injectable()
export class ClerkStrategy extends PassportStrategy(Strategy, 'clerk') {
  constructor(
    @Inject('ClerkClient')
    private readonly clerkClient: ClerkClient,
    private readonly configService: ScratchpadConfigService,
    private readonly userService: UsersService,
  ) {
    super();
  }

  async validate(req: Request): Promise<AuthenticatedUser> {
    const parts = req.headers.authorization?.split(' ');

    const tokenPrefix = parts?.[0];

    const token = parts?.[1];

    if (!token || tokenPrefix !== 'Bearer') {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const jwtPayload = await verifyToken(token, {
        secretKey: this.configService.getClerkSecretKey(),
      });

      const scratchpadPayload = jwtPayload as ScratchpadJwtPayload;

      const user = await this.userService.getOrCreateUserFromClerk(
        scratchpadPayload.sub,
        scratchpadPayload.fullName,
        scratchpadPayload.primaryEmail,
      );

      if (!user) {
        throw new UnauthorizedException('No Scratchpaper user found');
      }

      return {
        ...user,
        authType: 'jwt',
        authSource: 'user',
      };
    } catch (error) {
      if (error instanceof TokenVerificationError) {
        WSLogger.error({
          source: 'ClerkStrategy',
          message: 'JWT token failed to verify',
          reason: error.reason,
          action: error.action,
        });
      } else {
        WSLogger.error({
          source: 'ClerkStrategy',
          message: 'JWT token validation error',
          error,
        });
      }

      throw new UnauthorizedException('Invalid JWT token');
    }
  }
}
