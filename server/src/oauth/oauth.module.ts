import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from '../db/db.module';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { NotionOAuthProvider } from './providers/notion-oauth.provider';

@Module({
  imports: [ConfigModule, DbModule],
  controllers: [OAuthController],
  providers: [OAuthService, NotionOAuthProvider],
  exports: [OAuthService],
})
export class OAuthModule {}
