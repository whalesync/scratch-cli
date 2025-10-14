import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { OAuthModule } from '../../oauth/oauth.module';
import { UploadsModule } from '../../uploads/uploads.module';
import { ConnectorsService } from './connectors.service';

@Module({
  imports: [DbModule, OAuthModule, UploadsModule],
  providers: [ConnectorsService],
  exports: [ConnectorsService],
})
export class ConnectorsModule {}
