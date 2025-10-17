import { Injectable } from '@nestjs/common';
import { AuthType, ConnectorAccount, Service } from '@prisma/client';
import { DbService } from '../../db/db.service';
import { OAuthService } from '../../oauth/oauth.service';
import { UploadsDbService } from '../../uploads/uploads-db.service';
import { DecryptedCredentials } from '../connector-account/types/encrypted-credentials.interface';
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
    private readonly oauthService: OAuthService,
    private readonly uploadsDbService: UploadsDbService,
  ) {}

  async getConnector(params: {
    service: Service;
    connectorAccount: ConnectorAccount | null;
    decryptedCredentials: DecryptedCredentials | null;
  }): Promise<Connector<Service, any>> {
    const { service, connectorAccount, decryptedCredentials } = params;

    switch (service) {
      case Service.AIRTABLE:
        if (!connectorAccount) {
          throw new Error('Connector account is required for Airtable');
        }
        if (!decryptedCredentials?.apiKey) {
          throw new Error('API key is required for Airtable');
        }
        return new AirtableConnector(decryptedCredentials.apiKey);
      case Service.NOTION:
        if (!connectorAccount) {
          throw new Error('Connector account is required for Notion');
        }
        if (connectorAccount?.authType === AuthType.OAUTH) {
          // For OAuth accounts, get the valid access token
          const accessToken = await this.oauthService.getValidAccessToken(connectorAccount.id);
          return new NotionConnector(accessToken);
        } else {
          // For API key accounts, use the apiKey field
          if (!decryptedCredentials?.apiKey) {
            throw new Error('API key is required for Notion');
          }
          return new NotionConnector(decryptedCredentials.apiKey);
        }
      case Service.CUSTOM:
        if (!connectorAccount || !decryptedCredentials?.apiKey) {
          throw new Error('API key is required for Custom connector');
        }
        return new CustomConnector(connectorAccount.userId, this.db, decryptedCredentials.apiKey, connectorAccount);
      case Service.CSV:
        return new CsvConnector(this.db, this.uploadsDbService);
      case Service.YOUTUBE:
        if (!connectorAccount) {
          throw new Error('Connector account is required for YouTube');
        }
        if (connectorAccount.authType === AuthType.OAUTH) {
          // For OAuth accounts, get the valid access token and OAuth credentials
          const accessToken = await this.oauthService.getValidAccessToken(connectorAccount.id);
          return new YouTubeConnector(accessToken, connectorAccount);
        } else {
          // YouTube doesn't support API key authentication, only OAuth
          throw new Error('YouTube only supports OAuth authentication');
        }
      default:
        throw new Error(`Unsupported service: ${service}`);
    }
  }
}
