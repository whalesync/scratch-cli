import { Injectable } from '@nestjs/common';
import { AuthType, ConnectorAccount, Service } from '@prisma/client';
import { CsvFileService } from '../../csv-file/csv-file.service';
import { DbService } from '../../db/db.service';
import { OAuthService } from '../../oauth/oauth.service';
import { Connector } from './connector';
import { AirtableConnector } from './library/airtable/airtable-connector';
import { CsvConnector } from './library/csv/csv-connector';
import { CustomConnector } from './library/custom/custom-connector';
import { NotionConnector } from './library/notion/notion-connector';
import { YouTubeConnector } from './library/youtube/youtube-connector';

@Injectable()
export class ConnectorsService {
  constructor(
    private readonly db: DbService,
    private readonly csvFileService: CsvFileService,
    private readonly oauthService: OAuthService,
  ) {}

  async getConnector(account: ConnectorAccount): Promise<Connector<Service>> {
    switch (account.service) {
      case Service.AIRTABLE:
        return new AirtableConnector(account.apiKey);
      case Service.NOTION:
        if (account.authType === AuthType.OAUTH) {
          // For OAuth accounts, get the valid access token
          const accessToken = await this.oauthService.getValidAccessToken(account.id);
          return new NotionConnector(accessToken);
        } else {
          // For API key accounts, use the apiKey field
          return new NotionConnector(account.apiKey);
        }
      case Service.CUSTOM:
        return new CustomConnector(account.userId, this.db, account.apiKey);
      case Service.CSV:
        return new CsvConnector(this.csvFileService);
      case Service.YOUTUBE:
        if (account.authType === AuthType.OAUTH) {
          // For OAuth accounts, get the valid access token
          const accessToken = await this.oauthService.getValidAccessToken(account.id);
          return new YouTubeConnector(accessToken);
        } else {
          // YouTube doesn't support API key authentication, only OAuth
          throw new Error('YouTube only supports OAuth authentication');
        }
      default:
        throw new Error(`Unsupported service: ${account.service as string}`);
    }
  }
}
