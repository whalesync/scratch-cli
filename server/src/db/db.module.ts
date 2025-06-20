import { Module } from '@nestjs/common';
import { DbService } from './db.service';

@Module({
  providers: [DbService],
  exports: [DbService], //export this service to use in other modules
})
export class DbModule {}
