/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { youtube_v3 } from '@googleapis/youtube';
import { ConnectorAccount, Service } from '@prisma/client';
import { Connector } from '../../connector';
import { YouTubeTableSpec } from '../../library/custom-spec-registry';
import {
  ConnectorRecord,
  EntityId,
  ExistingSnapshotRecord,
  PostgresColumnType,
  SnapshotRecordSanitizedForUpdate,
  TablePreview,
} from '../../types';
import { YoutubeApiClient } from './youtube-api-client';

export class YouTubeConnector extends Connector<typeof Service.YOUTUBE> {
  readonly service = Service.YOUTUBE;
  private readonly apiClient: YoutubeApiClient;

  constructor(private readonly accessToken: string) {
    super();
    this.apiClient = new YoutubeApiClient(accessToken);
  }

  async testConnection(): Promise<void> {
    // Test connection by fetching user's channels
    await this.apiClient.getChannels();
  }

  async listTables(account: ConnectorAccount): Promise<TablePreview[]> {
    const channelsResponse = await this.apiClient.getChannels();

    if (!channelsResponse.items) {
      return [];
    }

    // Get the user's own channels (marked with mine: true)
    const ownChannels = channelsResponse.items.map(
      (channel) =>
        ({
          id: {
            wsId: `channel_${channel.id}`,
            remoteId: [channel.id || ''],
          },
          displayName: channel.snippet?.title || `Channel ${channel.id}`,
          metadata: {
            channelId: channel.id,
            channelTitle: channel.snippet?.title,
            description: channel.snippet?.description,
            publishedAt: channel.snippet?.publishedAt,
            mine: true,
          },
        }) satisfies TablePreview,
    );

    // Get additional channels from extras if they exist
    const additionalChannels: TablePreview[] = [];
    const accountWithExtras = account as ConnectorAccount & { extras?: Record<string, unknown> };
    if (
      accountWithExtras.extras &&
      typeof accountWithExtras.extras === 'object' &&
      'additionalChannels' in accountWithExtras.extras
    ) {
      const additionalChannelIds = accountWithExtras.extras.additionalChannels;
      if (Array.isArray(additionalChannelIds) && additionalChannelIds.length > 0) {
        try {
          // Fetch additional channels by their IDs
          const additionalChannelsResponse = await this.apiClient.getChannelsByIds(additionalChannelIds);
          if (additionalChannelsResponse.items) {
            additionalChannels.push(
              ...additionalChannelsResponse.items.map(
                (channel) =>
                  ({
                    id: {
                      wsId: `channel_${channel.id}`,
                      remoteId: [channel.id || ''],
                    },
                    displayName: channel.snippet?.title || `Channel ${channel.id}`,
                    metadata: {
                      channelId: channel.id,
                      channelTitle: channel.snippet?.title,
                      description: channel.snippet?.description,
                      publishedAt: channel.snippet?.publishedAt,
                      extra: true,
                    },
                  }) satisfies TablePreview,
              ),
            );
          }
        } catch (error) {
          console.debug('Failed to fetch additional channels:', error);
          // Continue without additional channels if there's an error
        }
      }
    }

    return [...ownChannels, ...additionalChannels];
  }

  async fetchTableSpec(id: EntityId, _account: ConnectorAccount): Promise<YouTubeTableSpec> {
    const channelId = id.remoteId[0];

    // Get channel info to get the channel title
    const channelsResponse = await this.apiClient.getChannels();
    const channel = channelsResponse.items?.find((c) => c.id === channelId);

    return {
      id,
      name: channel?.snippet?.title || `Channel ${channelId}`,
      columns: [
        {
          id: { wsId: 'title', remoteId: ['title'] },
          name: 'Title',
          pgType: PostgresColumnType.TEXT,
          youtubeField: 'snippet.title',
        },
        {
          id: { wsId: 'description', remoteId: ['description'] },
          name: 'Description',
          pgType: PostgresColumnType.TEXT,
          youtubeField: 'snippet.description',
        },
        {
          id: { wsId: 'url', remoteId: ['url'] },
          name: 'URL',
          readonly: true,
          pgType: PostgresColumnType.TEXT,
          youtubeField: 'url',
        },
        {
          id: { wsId: 'publishedAt', remoteId: ['publishedAt'] },
          name: 'Published At',
          readonly: true,
          pgType: PostgresColumnType.TEXT,
          youtubeField: 'snippet.publishedAt',
        },
        {
          id: { wsId: 'transcript', remoteId: ['transcript'] },
          name: 'Transcript',
          readonly: true,
          pgType: PostgresColumnType.TEXT,
          youtubeField: 'transcript',
        },
        {
          id: { wsId: 'visibility', remoteId: ['visibility'] },
          name: 'Visibility',
          pgType: PostgresColumnType.TEXT,
          youtubeField: 'status.privacyStatus',
          readonly: true,
          limitedToValues: ['public', 'unlisted', 'private'],
        },
        {
          id: { wsId: 'categoryId', remoteId: ['categoryId'] },
          name: 'Category ID',
          pgType: PostgresColumnType.TEXT,
          youtubeField: 'snippet.categoryId',
          readonly: true,
        },
        {
          id: { wsId: 'defaultLanguage', remoteId: ['defaultLanguage'] },
          name: 'Default Language',
          pgType: PostgresColumnType.TEXT,
          youtubeField: 'snippet.defaultLanguage',
        },
        {
          id: { wsId: 'tags', remoteId: ['tags'] },
          name: 'Tags',
          pgType: PostgresColumnType.TEXT_ARRAY,
          youtubeField: 'snippet.tags',
        },
      ],
    } as YouTubeTableSpec;
  }

  async downloadTableRecords(
    tableSpec: YouTubeTableSpec,
    callback: (records: ConnectorRecord[]) => Promise<void>,
    _account: ConnectorAccount,
  ): Promise<void> {
    const channelId = tableSpec.id.remoteId[0];
    let nextPageToken: string | undefined;

    do {
      const videosResponse = await this.apiClient.getVideos(channelId, nextPageToken);

      if (!videosResponse.items) {
        break;
      }

      const records: ConnectorRecord[] = await Promise.all(
        videosResponse.items.map((video) => this.formatRecord(video, tableSpec)),
      );

      await callback(records);

      nextPageToken = videosResponse.nextPageToken || undefined;
    } while (nextPageToken);
  }

  getBatchSize(operation: 'create' | 'update' | 'delete'): number {
    // YouTube API has rate limits, so we use smaller batch sizes
    switch (operation) {
      case 'create':
        return 1; // YouTube doesn't support batch video creation
      case 'update':
        return 1; // YouTube doesn't support batch video updates
      case 'delete':
        return 1; // YouTube doesn't support batch video deletion
      default:
        return 1;
    }
  }

  createRecords(
    _tableSpec: YouTubeTableSpec,
    _records: { wsId: string; fields: Record<string, unknown> }[],
    _account: ConnectorAccount,
  ): Promise<{ wsId: string; remoteId: string }[]> {
    // YouTube doesn't support creating videos through the API
    // Videos must be uploaded through the YouTube interface
    throw new Error(
      'YouTube does not support creating videos through the API. Videos must be uploaded through the YouTube interface.',
    );
  }

  async updateRecords(
    _tableSpec: YouTubeTableSpec,
    records: SnapshotRecordSanitizedForUpdate[],
    _account: ConnectorAccount,
  ): Promise<void> {
    // YouTube allows updating snippet fields including title, description, defaultLanguage, and tags
    for (const record of records) {
      const videoId = record.id.remoteId;
      const updateData: any = {};

      // Update snippet fields
      if (record.partialFields.title) {
        updateData.title = record.partialFields.title;
      }
      if (record.partialFields.description) {
        updateData.description = record.partialFields.description;
      }
      if (record.partialFields.defaultLanguage) {
        updateData.defaultLanguage = record.partialFields.defaultLanguage;
      }
      if (record.partialFields.tags && Array.isArray(record.partialFields.tags)) {
        // Tags are already an array
        updateData.tags = record.partialFields.tags;
      }

      if (Object.keys(updateData).length > 0) {
        // We need a category ID for YouTube updates - using a default
        const categoryId = '22'; // People & Blogs category
        await this.apiClient.updateVideo(videoId, updateData, categoryId);
      }
    }
  }

  deleteRecords(
    _tableSpec: YouTubeTableSpec,
    _recordIds: { wsId: string; remoteId: string }[],
    _account: ConnectorAccount,
  ): Promise<void> {
    // YouTube doesn't support deleting videos through the API
    // Videos must be deleted through the YouTube interface
    throw new Error(
      'YouTube does not support deleting videos through the API. Videos must be deleted through the YouTube interface.',
    );
  }

  private async formatRecord(
    youtubeRecord: youtube_v3.Schema$Video,
    _tableSpec: YouTubeTableSpec,
  ): Promise<ConnectorRecord> {
    // Handle Video type from videos.list API
    const videoId = youtubeRecord.id || null;

    // Fetch transcript for the video
    let transcript = '';
    if (videoId) {
      try {
        const transcriptData = await this.apiClient.getVideoTranscript(videoId);
        transcript = transcriptData || '';
      } catch (error) {
        console.debug(`Failed to fetch transcript for video ${videoId}:`, error);
        transcript = '';
      }
    }

    return {
      id: videoId || '',
      fields: {
        title: youtubeRecord.snippet?.title || '',
        description: youtubeRecord.snippet?.description || '',
        url: this.getWatchVideoUrl(videoId),
        publishedAt: youtubeRecord.snippet?.publishedAt || '',
        transcript,
        visibility: youtubeRecord.status?.privacyStatus || '',
        categoryId: youtubeRecord.snippet?.categoryId || '',
        defaultLanguage: youtubeRecord.snippet?.defaultLanguage || '',
        tags: youtubeRecord.snippet?.tags || [],
      },
    };
  }

  private getWatchVideoUrl(videoId?: string | null): string {
    if (!videoId) return '';
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  public override sanitizeRecordForUpdate(
    record: ExistingSnapshotRecord,
    tableSpec: YouTubeTableSpec,
  ): SnapshotRecordSanitizedForUpdate {
    const { id, fields } = record;
    const newFields: typeof fields = {};
    newFields.title = fields.title;
    newFields.description = fields.description;
    newFields.categoryId = fields.categoryId;
    newFields.defaultLanguage = fields.defaultLanguage;
    newFields.tags = fields.tags;
    const sanitizedRecord: SnapshotRecordSanitizedForUpdate = {
      id,
      partialFields: newFields,
    };
    return sanitizedRecord;
  }
}
