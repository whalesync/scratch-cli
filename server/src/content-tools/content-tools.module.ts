import { Module } from '@nestjs/common';
import { CsvFileModule } from 'src/csv-file/csv-file.module';
import { DbModule } from 'src/db/db.module';
import { ConnectorAccountModule } from '../remote-service/connector-account/connector-account.module';
import { SnapshotModule } from '../snapshot/snapshot.module';
import { ContentToolsController } from './content-tools.controller';
import { ContentToolsService } from './content-tools.service';

@Module({
  providers: [ContentToolsService],
  imports: [DbModule, ConnectorAccountModule, SnapshotModule, CsvFileModule],
  exports: [ContentToolsService],
  controllers: [ContentToolsController],
})
export class ContentToolsModule {}
