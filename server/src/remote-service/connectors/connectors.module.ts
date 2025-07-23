import { Module } from '@nestjs/common';
import { CsvFileModule } from '../../csv-file/csv-file.module';
import { DbModule } from '../../db/db.module';
import { ConnectorsService } from './connectors.service';

@Module({
  imports: [DbModule, CsvFileModule],
  providers: [ConnectorsService],
  exports: [ConnectorsService],
})
export class ConnectorsModule {}
