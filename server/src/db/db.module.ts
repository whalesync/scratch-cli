import { Module } from '@nestjs/common';
import { ScratchConfigModule } from '../config/scratch-config.module';
import { DbService } from './db.service';

@Module({
  imports: [ScratchConfigModule],
  providers: [DbService],
  exports: [DbService], //export this service to use in other modules
})
export class DbModule {}
