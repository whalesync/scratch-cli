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
    const token = req.headers.authorization?.split(' ').pop();

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const tokenPayload = await verifyToken(token, {
        secretKey: this.configService.getClerkSecretKey(),
      });

      const clerkUser = await this.clerkClient.users.getUser(tokenPayload.sub);

      if (!clerkUser) {
        throw new UnauthorizedException('Invalid token');
      }

      const user = await this.userService.getOrCreateUserFromClerk(clerkUser);

      if (!user) {
        throw new UnauthorizedException('Invalid token');
      }

      return user;
    } catch (error) {
      console.error(error);
      throw new UnauthorizedException('Invalid token');
    }
  }
}
