import { Service } from '@spinner/shared-types';
import { AirtableConnector } from './library/airtable/airtable-connector';
import { AudiencefulConnector } from './library/audienceful/audienceful-connector';
import { MocoConnector } from './library/moco/moco-connector';
import { NotionConnector } from './library/notion/notion-connector';
import { WebflowConnector } from './library/webflow/webflow-connector';
import { WixBlogConnector } from './library/wix/wix-blog/wix-blog-connector';
import { WordPressConnector } from './library/wordpress/wordpress-connector';
import { YouTubeConnector } from './library/youtube/youtube-connector';

/**
 * Maps a Service enum value to its display name.
 * @param service - The Service enum value.
 * @returns The display name for the service.
 */
export function getServiceDisplayName(service: Service): string {
  switch (service) {
    case Service.NOTION:
      return NotionConnector.displayName;
    case Service.AIRTABLE:
      return AirtableConnector.displayName;
    case Service.CSV:
      return 'CSV';
    case Service.POSTGRES:
      return 'PostgreSQL';
    case Service.YOUTUBE:
      return YouTubeConnector.displayName;
    case Service.WORDPRESS:
      return WordPressConnector.displayName;
    case Service.WEBFLOW:
      return WebflowConnector.displayName;
    case Service.WIX_BLOG:
      return WixBlogConnector.displayName;
    case Service.AUDIENCEFUL:
      return AudiencefulConnector.displayName;
    case Service.MOCO:
      return MocoConnector.displayName;
    default: {
      // Exhaustive check - TypeScript will error if a Service case is missing
      const _exhaustiveCheck: never = service;
      return _exhaustiveCheck;
    }
  }
}
