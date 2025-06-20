import { Module } from '@nestjs/common';
import { DbService } from './db.service';
import { ScratchpadConfigModule } from '../config/scratchpad-config.module';

@Module({
  imports: [ScratchpadConfigModule],
  providers: [DbService],
  exports: [DbService], //export this service to use in other modules
})
export class DbModule {}
