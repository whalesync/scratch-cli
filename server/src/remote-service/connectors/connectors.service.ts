import { Injectable } from '@nestjs/common';
import { AuthType, ConnectorAccount } from '@prisma/client';
import { Service } from '@spinner/shared-types';
import { OAuthService } from '../../oauth/oauth.service';
import { DecryptedCredentials } from '../connector-account/types/encrypted-credentials.interface';
import { AuthParser, Connector } from './connector';
import { ConnectorInstantiationError } from './error';
import { AirtableConnector } from './library/airtable/airtable-connector';
import { NotionConnector } from './library/notion/notion-connector';
import { WebflowConnector } from './library/webflow/webflow-connector';
import { WixBlogConnector } from './library/wix/wix-blog/wix-blog-connector';
import { WordPressAuthParser } from './library/wordpress/wordpress-auth-parser';
import { WordPressConnector } from './library/wordpress/wordpress-connector';
import { YouTubeConnector } from './library/youtube/youtube-connector';

@Injectable()
export class ConnectorsService {
  constructor(private readonly oauthService: OAuthService) {}

  getAuthParser(params: { service: Service }): AuthParser<Service> | undefined {
    const { service } = params;

    switch (service) {
      case Service.WORDPRESS:
        return new WordPressAuthParser();
      default:
        return undefined;
    }
  }

  async getConnector(params: {
    service: Service;
    connectorAccount: ConnectorAccount | null;
    decryptedCredentials: DecryptedCredentials | null;
    userId?: string;
  }): Promise<Connector<Service, any>> {
    const { service, connectorAccount, decryptedCredentials } = params;

    switch (service) {
      case Service.AIRTABLE:
        if (!connectorAccount) {
          throw new ConnectorInstantiationError('Connector account is required for Airtable', service);
        }
        if (!decryptedCredentials?.apiKey) {
          throw new ConnectorInstantiationError('API key is required for Airtable', service);
        }
        return new AirtableConnector(decryptedCredentials.apiKey);
      case Service.WORDPRESS:
        if (!connectorAccount) {
          throw new ConnectorInstantiationError('Connector account is required for WordPress', service);
        }
        if (!decryptedCredentials?.username) {
          throw new ConnectorInstantiationError('Username is required for WordPress', service);
        }
        if (!decryptedCredentials?.password) {
          throw new ConnectorInstantiationError('Password is required for WordPress', service);
        }
        if (!decryptedCredentials?.endpoint) {
          throw new ConnectorInstantiationError('Endpoint is required for WordPress', service);
        }
        return new WordPressConnector(
          decryptedCredentials.username,
          decryptedCredentials.password,
          decryptedCredentials.endpoint,
        );
      case Service.NOTION:
        if (!connectorAccount) {
          throw new ConnectorInstantiationError('Connector account is required for Notion', service);
        }
        if (connectorAccount?.authType === AuthType.OAUTH) {
          // For OAuth accounts, get the valid access token
          const accessToken = await this.oauthService.getValidAccessToken(connectorAccount.id);
          return new NotionConnector(accessToken);
        } else {
          // For API key accounts, use the apiKey field
          if (!decryptedCredentials?.apiKey) {
            throw new ConnectorInstantiationError('API key is required for Notion', service);
          }
          return new NotionConnector(decryptedCredentials.apiKey);
        }
      case Service.YOUTUBE:
        if (!connectorAccount) {
          throw new ConnectorInstantiationError('Connector account is required for YouTube', service);
        }
        if (connectorAccount.authType === AuthType.OAUTH) {
          // For OAuth accounts, get the valid access token and OAuth credentials
          const accessToken = await this.oauthService.getValidAccessToken(connectorAccount.id);
          return new YouTubeConnector(accessToken, connectorAccount);
        } else {
          // YouTube doesn't support API key authentication, only OAuth
          throw new Error('YouTube only supports OAuth authentication');
        }
      case Service.WEBFLOW:
        if (!connectorAccount) {
          throw new ConnectorInstantiationError('Connector account is required for Webflow', service);
        }
        if (connectorAccount.authType === AuthType.OAUTH) {
          // For OAuth accounts, get the valid access token
          const accessToken = await this.oauthService.getValidAccessToken(connectorAccount.id);
          return new WebflowConnector(accessToken);
        } else {
          // For API key accounts, use the apiKey field
          if (!decryptedCredentials?.apiKey) {
            throw new ConnectorInstantiationError('API key is required for Webflow', service);
          }
          return new WebflowConnector(decryptedCredentials.apiKey);
        }
      case Service.WIX_BLOG:
        if (!connectorAccount) {
          throw new ConnectorInstantiationError('Connector account is required for Wix', service);
        }
        if (connectorAccount.authType === AuthType.OAUTH) {
          // For OAuth accounts, get the valid access token
          // Site ID is automatically discovered via App Instance API
          const accessToken = await this.oauthService.getValidAccessToken(connectorAccount.id);
          return new WixBlogConnector(accessToken);
        } else {
          throw new Error('Wix requires either OAuth or API key authentication');
        }
      default:
        throw new ConnectorInstantiationError(`Unsupported service: ${service}`, service);
    }
  }
}
