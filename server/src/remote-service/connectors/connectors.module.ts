import { Module } from '@nestjs/common';
import { OAuthModule } from '../../oauth/oauth.module';
import { ConnectorsService } from './connectors.service';

@Module({
  imports: [OAuthModule],
  providers: [ConnectorsService],
  exports: [ConnectorsService],
})
export class ConnectorsModule {}
