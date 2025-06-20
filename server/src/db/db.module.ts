import { Module } from '@nestjs/common';
import { ScratchpadConfigModule } from '../config/scratchpad-config.module';
import { DbService } from './db.service';

@Module({
  imports: [ScratchpadConfigModule],
  providers: [DbService],
  exports: [DbService], //export this service to use in other modules
})
export class DbModule {}
