import { Module } from '@nestjs/common';

import { DbModule } from '../db/db.module';
import { UserService } from './user.service';

@Module({
  providers: [UserService],
  imports: [DbModule],
  exports: [UserService], //export this service to use in other modules
})
export class UserModule {}
