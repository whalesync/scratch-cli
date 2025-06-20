import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { ConnectorsService } from './connectors.service';

@Module({
  imports: [DbModule],
  providers: [ConnectorsService],
  exports: [ConnectorsService],
})
export class ConnectorsModule {}
