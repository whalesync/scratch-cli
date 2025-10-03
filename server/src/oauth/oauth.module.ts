import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PosthogModule } from 'src/posthog/posthog.module';
import { DbModule } from '../db/db.module';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { NotionOAuthProvider } from './providers/notion-oauth.provider';
import { YouTubeOAuthProvider } from './providers/youtube-oauth.provider';

@Module({
  imports: [ConfigModule, DbModule, PosthogModule],
  controllers: [OAuthController],
  providers: [OAuthService, NotionOAuthProvider, YouTubeOAuthProvider],
  exports: [OAuthService],
})
export class OAuthModule {}
