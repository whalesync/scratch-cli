import { Controller, Get, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ScratchpadAuthGuard } from 'src/auth/scratchpad-auth.guard';
import { RequestWithUser } from 'src/auth/types';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(ScratchpadAuthGuard)
  @Get('current')
  currentUser(@Req() req: RequestWithUser): User {
    if (!req.user) {
      throw new UnauthorizedException();
    }
    return new User(req.user);
  }
}
