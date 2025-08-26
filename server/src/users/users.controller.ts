import { Controller, Get, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtGeneratorService } from 'src/agent-jwt/jwt-generator.service';
import { ScratchpadAuthGuard } from 'src/auth/scratchpad-auth.guard';
import { RequestWithUser } from 'src/auth/types';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtGeneratorService: JwtGeneratorService,
  ) {}

  @UseGuards(ScratchpadAuthGuard)
  @Get('current')
  currentUser(@Req() req: RequestWithUser): User {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    // Generate a JWT for the client to pass to the agent
    const agentJwt = this.jwtGeneratorService.generateToken({
      userId: req.user.id,
      role: req.user.role,
    });

    return new User(req.user, agentJwt);
  }
}
