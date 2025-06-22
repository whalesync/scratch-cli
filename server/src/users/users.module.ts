import { Module } from '@nestjs/common';

import { DbModule } from '../db/db.module';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  providers: [UsersService],
  imports: [DbModule],
  exports: [UsersService], //export this service to use in other modules
  controllers: [UsersController],
})
export class UserModule {}
