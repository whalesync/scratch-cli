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
          id: { wsId: 'transcript', remoteId: ['transcript'] },
          name: 'Transcript',
          // readonly: true,
          pgType: PostgresColumnType.TEXT,
          youtubeField: 'transcript',
        },
        {
          id: { wsId: 'transcriptId', remoteId: ['transcriptId'] },
          name: 'Transcript Id',
          readonly: true,
          pgType: PostgresColumnType.TEXT,
          youtubeField: 'transcriptId',
        },
        {
          id: { wsId: 'categoryId', remoteId: ['categoryId'] },
          name: 'Category ID',
          pgType: PostgresColumnType.TEXT,
          youtubeField: 'snippet.categoryId',
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
          readonly: true,
          youtubeField: 'snippet.tags',
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
        videosResponse.items.map((video) => this.formatRecordWithoutTranscript(video, tableSpec)),
      );

      await callback(records);

      nextPageToken = videosResponse.nextPageToken || undefined;
    } while (nextPageToken);
  }

  async downloadRecordDeep(
    tableSpec: YouTubeTableSpec,
    existingRecord: ExistingSnapshotRecord,
    fields: string[] | null,
    callback: (records: ConnectorRecord[]) => Promise<void>,
    _account: ConnectorAccount,
  ): Promise<void> {
    // Extract the YouTube video ID from the existing record
    const videoId = existingRecord.id.remoteId;

    if (!videoId) {
      throw new Error('Video ID not found in existing record');
    }

    // Get the video details first
    const videoResponse = await this.apiClient.getVideo(videoId);

    if (!videoResponse.items || videoResponse.items.length === 0) {
      throw new Error(`Video with ID ${videoId} not found`);
    }

    const video = videoResponse.items[0];

    // Check if we need to fetch transcript (if fields is null or includes 'transcript')
    const needsTranscript = fields === null || fields.includes('transcript');

    let transcript = '';
    let transcriptId: string | null = null;
    if (needsTranscript) {
      try {
        const { text: transcriptData, id: transcriptIdData } = await this.apiClient.getVideoTranscript(videoId);
        transcript = transcriptData || '';
        transcriptId = transcriptIdData;
      } catch (error) {
        console.debug(`Failed to fetch transcript for video ${videoId}:`, error);
        transcript = '';
      }
    }

    existingRecord.fields.transcript = transcript;
    existingRecord.fields.transcriptId = transcriptId;
    // Format the record with the transcript
    // const record = this.formatRecordWithTranscript(video, tableSpec, transcript);
    await callback([
      {
        id: existingRecord.id.remoteId,
        fields: existingRecord.fields,
      },
    ]);
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
      const updateData: any = {
        title: record.partialFields.title,
        description: record.partialFields.description,
        categoryId: record.partialFields.categoryId,
        defaultLanguage: record.partialFields.defaultLanguage,
        tags: record.partialFields.tags,
      };

      if (Object.keys(updateData).length > 0) {
        await this.apiClient.updateVideo(videoId, updateData);
      }

      if (record.partialFields.transcript && record.partialFields.transcriptId) {
        try {
          await this.apiClient.updateTranscript(
            record.partialFields.transcriptId as string,
            record.partialFields.transcript as string,
          );
        } catch (error) {
          console.warn(`Failed to update transcript for video ${videoId}:`, error);
          // Don't throw here as transcript update is optional and may fail due to API limitations
        }
      }

      // TODO: update visibility
    }
  }

  deleteRecords(
    _tableSpec: YouTubeTableSpec,
    _recordIds: { wsId: string; remoteId: string }[],
    _account: ConnectorAccount,
  ): Promise<void> {
    // YouTube doesn't support deleting videos through the API
    // Videos must be deleted through the YouTube interface
    return Promise.reject(
      new Error(
        'YouTube does not support deleting videos through the API. Videos must be deleted through the YouTube interface.',
      ),
    );
  }

  private formatRecordWithoutTranscript(
    youtubeRecord: youtube_v3.Schema$Video,
    _tableSpec: YouTubeTableSpec,
  ): ConnectorRecord {
    const videoId = youtubeRecord.id || '';

    return {
      id: videoId,
      fields: {
        title: youtubeRecord.snippet?.title || '',
        description: youtubeRecord.snippet?.description || '',
        url: this.getWatchVideoUrl(videoId),
        publishedAt: youtubeRecord.snippet?.publishedAt || '',
        transcript: '', // Empty transcript - will be fetched via downloadRecordDeep
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

    // For YouTube, we need to include all snippet fields since YouTube expects the full snippet to replace
    // But for transcript, we only include it if it was actually edited
    const editedFieldNames = tableSpec.columns
      .map((c) => c.id.wsId)
      .filter((colWsId) => !!record.__edited_fields[colWsId]);

    const newFields: typeof fields = {};

    // Always include these fields (YouTube snippet fields)
    newFields.title = fields.title;
    newFields.description = fields.description;
    newFields.categoryId = fields.categoryId;
    newFields.defaultLanguage = fields.defaultLanguage;
    newFields.tags = fields.tags;

    // Only include transcript if it was edited
    if (editedFieldNames.includes('transcript')) {
      newFields.transcript = fields.transcript;
      newFields.transcriptId = fields.transcriptId;
    }

    const sanitizedRecord: SnapshotRecordSanitizedForUpdate = {
      id,
      partialFields: newFields,
    };
    return sanitizedRecord;
  }
}
