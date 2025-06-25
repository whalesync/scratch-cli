import { ClerkClient, verifyToken } from '@clerk/backend';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { User } from '@prisma/client';
import { Request } from 'express';
import { Strategy } from 'passport-custom';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { UsersService } from 'src/users/users.service';

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

  async validate(req: Request): Promise<User> {
    const parts = req.headers.authorization?.split(' ');

    const tokenPrefix = parts?.[0];

    const token = parts?.[1];

    if (!token || tokenPrefix !== 'Bearer') {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const tokenPayload = await verifyToken(token, {
        secretKey: this.configService.getClerkSecretKey(),
      });

      const clerkUser = await this.clerkClient.users.getUser(tokenPayload.sub);

      if (!clerkUser) {
        throw new UnauthorizedException('No clerk user found');
      }

      const user = await this.userService.getOrCreateUserFromClerk(clerkUser);

      if (!user) {
        throw new UnauthorizedException('No Scratchpad user found');
      }

      return user;
    } catch (error) {
      console.error(error);
      throw new UnauthorizedException('Invalid JWT token');
    }
  }
}
