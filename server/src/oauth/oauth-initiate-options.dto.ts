import { IsOptional, IsString } from 'class-validator';

/**
 * Keep in sync with spinner/client/src/types/server-entities/oauth.ts:OAuthInitiateOptionsDto.
 */
export class OAuthInitiateOptionsDto {
  @IsString()
  @IsOptional()
  connectionMethod?: 'OAUTH_SYSTEM' | 'OAUTH_CUSTOM';

  @IsString()
  @IsOptional()
  customClientId?: string;

  @IsString()
  @IsOptional()
  customClientSecret?: string;

  @IsString()
  @IsOptional()
  connectionName?: string;
}
