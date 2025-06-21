import { Controller, Get, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ScratchpadAuthGuard } from 'src/auth/scratchpad-auth.guard';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

interface RequestWithUser extends Request {
  user: User;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(ScratchpadAuthGuard)
  @Get('current')
  currentUser(@Req() req: RequestWithUser): User {
    if (!req.user) {
      throw new UnauthorizedException();
    }
    return req.user;
  }
}
