import { Module } from '@nestjs/common';
import { CsvFileModule } from '../../csv-file/csv-file.module';
import { DbModule } from '../../db/db.module';
import { OAuthModule } from '../../oauth/oauth.module';
import { ConnectorsService } from './connectors.service';

@Module({
  imports: [DbModule, CsvFileModule, OAuthModule],
  providers: [ConnectorsService],
  exports: [ConnectorsService],
})
export class ConnectorsModule {}
