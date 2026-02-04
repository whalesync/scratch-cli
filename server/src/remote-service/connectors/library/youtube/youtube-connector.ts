/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { youtube_v3 } from '@googleapis/youtube';
import { ConnectorAccount } from '@prisma/client';
import { Type } from '@sinclair/typebox';
import { Service } from '@spinner/shared-types';
import { WSLogger } from 'src/logger';
import { JsonSafeObject } from 'src/utils/objects';
import type { SnapshotColumnSettingsMap } from 'src/workbook/types';
import { Connector } from '../../connector';
import { YouTubeTableSpec } from '../../library/custom-spec-registry';
import {
  BaseJsonTableSpec,
  ConnectorErrorDetails,
  ConnectorFile,
  ConnectorRecord,
  EntityId,
  ExistingSnapshotRecord,
  SnapshotRecordSanitizedForUpdate,
  TablePreview,
} from '../../types';
import { YoutubeApiClient } from './youtube-api-client';

export class YouTubeConnector extends Connector<typeof Service.YOUTUBE> {
  readonly service = Service.YOUTUBE;
  static readonly displayName = 'YouTube';

  private readonly apiClient: YoutubeApiClient;

  constructor(
    private readonly accessToken: string,
    private readonly account: ConnectorAccount,
  ) {
    super();
    this.apiClient = new YoutubeApiClient(accessToken);
  }

  async testConnection(): Promise<void> {
    // Test connection by fetching user's channels
    await this.apiClient.getChannels();
  }

  async listTables(): Promise<TablePreview[]> {
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
    const accountWithExtras = this.account as ConnectorAccount & { extras?: Record<string, unknown> };
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

  /**
   * Fetch JSON Table Spec for YouTube videos.
   * Returns a schema describing the raw YouTube video API response format.
   */
  async fetchJsonTableSpec(id: EntityId): Promise<BaseJsonTableSpec> {
    const channelId = id.remoteId[0];

    // Get channel info for display name
    const channelsResponse = await this.apiClient.getChannels();
    const channel = channelsResponse.items?.find((c) => c.id === channelId);
    const channelTitle = channel?.snippet?.title || `Channel ${channelId}`;

    // Build schema for YouTube video response
    const schema = Type.Object(
      {
        kind: Type.Optional(Type.String({ description: 'Resource type identifier' })),
        etag: Type.Optional(Type.String({ description: 'ETag of this resource' })),
        id: Type.String({ description: 'Unique video identifier' }),
        snippet: Type.Optional(
          Type.Object(
            {
              publishedAt: Type.Optional(Type.String({ description: 'Video publish date', format: 'date-time' })),
              channelId: Type.Optional(Type.String({ description: 'Channel ID' })),
              title: Type.Optional(Type.String({ description: 'Video title' })),
              description: Type.Optional(Type.String({ description: 'Video description' })),
              thumbnails: Type.Optional(
                Type.Record(Type.String(), Type.Unknown(), { description: 'Thumbnail images' }),
              ),
              channelTitle: Type.Optional(Type.String({ description: 'Channel title' })),
              tags: Type.Optional(Type.Array(Type.String(), { description: 'Video tags' })),
              categoryId: Type.Optional(Type.String({ description: 'Video category ID' })),
              defaultLanguage: Type.Optional(Type.String({ description: 'Default language' })),
              defaultAudioLanguage: Type.Optional(Type.String({ description: 'Default audio language' })),
            },
            { description: 'Video snippet metadata' },
          ),
        ),
        contentDetails: Type.Optional(
          Type.Object(
            {
              duration: Type.Optional(Type.String({ description: 'Video duration in ISO 8601 format' })),
              dimension: Type.Optional(Type.String({ description: '2d or 3d' })),
              definition: Type.Optional(Type.String({ description: 'hd or sd' })),
              caption: Type.Optional(Type.String({ description: 'Caption availability' })),
              licensedContent: Type.Optional(Type.Boolean({ description: 'Licensed content flag' })),
            },
            { description: 'Video content details' },
          ),
        ),
        status: Type.Optional(
          Type.Object(
            {
              uploadStatus: Type.Optional(Type.String({ description: 'Upload status' })),
              privacyStatus: Type.Optional(
                Type.String({ description: 'Privacy status: public, unlisted, or private' }),
              ),
              license: Type.Optional(Type.String({ description: 'Video license' })),
              embeddable: Type.Optional(Type.Boolean({ description: 'Can video be embedded' })),
              publicStatsViewable: Type.Optional(Type.Boolean({ description: 'Public stats visibility' })),
              madeForKids: Type.Optional(Type.Boolean({ description: 'Made for kids flag' })),
            },
            { description: 'Video status information' },
          ),
        ),
        statistics: Type.Optional(
          Type.Object(
            {
              viewCount: Type.Optional(Type.String({ description: 'View count' })),
              likeCount: Type.Optional(Type.String({ description: 'Like count' })),
              commentCount: Type.Optional(Type.String({ description: 'Comment count' })),
            },
            { description: 'Video statistics' },
          ),
        ),
      },
      {
        $id: `youtube/${channelId}`,
        title: channelTitle,
      },
    );

    return {
      id,
      slug: id.wsId,
      name: channelTitle,
      schema,
      idColumnRemoteId: 'id',
      titleColumnRemoteId: [channelId, 'snippet.title'],
      mainContentColumnRemoteId: [channelId, 'snippet.description'],
    };
  }

  async pullTableRecords(
    tableSpec: YouTubeTableSpec,
    columnSettingsMap: SnapshotColumnSettingsMap,
    callback: (params: { records: ConnectorRecord[]; progress?: JsonSafeObject }) => Promise<void>,
  ): Promise<void> {
    const channelId = tableSpec.id.remoteId[0];
    let nextPageToken: string | undefined;

    do {
      const videosResponse = await this.apiClient.getVideos(channelId, nextPageToken);

      if (!videosResponse.items) {
        break;
      }

      const records: ConnectorRecord[] = videosResponse.items.map((video) =>
        this.formatRecordWithoutTranscript(video, tableSpec),
      );

      await callback({ records });

      nextPageToken = videosResponse.nextPageToken || undefined;
    } while (nextPageToken);
  }

  async pullRecordFiles(
    tableSpec: BaseJsonTableSpec,
    callback: (params: { files: ConnectorFile[]; connectorProgress?: JsonSafeObject }) => Promise<void>,
    progress: JsonSafeObject,
  ): Promise<void> {
    WSLogger.info({ source: 'YouTubeConnector', message: 'pullRecordFiles called', tableId: tableSpec.id.wsId });
    await callback({ files: [], connectorProgress: progress });
  }

  async pullRecordDeep(
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
    let captionListItems: youtube_v3.Schema$Caption[] | null = null;
    if (needsTranscript) {
      try {
        const {
          text: transcriptData,
          id: transcriptIdData,
          captionListItems: captionListItemsData,
        } = await this.apiClient.getVideoTranscript(videoId);
        transcript = transcriptData || '';
        transcriptId = transcriptIdData;
        captionListItems = captionListItemsData;
      } catch (error) {
        console.debug(`Failed to fetch transcript for video ${videoId}:`, error);
        transcript = '';
      }
    }

    existingRecord.fields.transcript = transcript;
    existingRecord.fields.transcriptId = transcriptId;
    existingRecord.fields.captionListItems = captionListItems;
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

  /**
   * YouTube doesn't support creating videos through the API.
   * Videos must be uploaded through the YouTube interface.
   */
  createRecords(
    _tableSpec: BaseJsonTableSpec,
    _columnSettingsMap: SnapshotColumnSettingsMap,
    _files: ConnectorFile[],
  ): Promise<ConnectorFile[]> {
    throw new Error(
      'YouTube does not support creating videos through the API. Videos must be uploaded through the YouTube interface.',
    );
  }

  /**
   * Update videos in YouTube from raw JSON files.
   * Files should have an 'id' field and snippet fields to update.
   */
  async updateRecords(
    _tableSpec: BaseJsonTableSpec,
    _columnSettingsMap: SnapshotColumnSettingsMap,
    files: ConnectorFile[],
  ): Promise<void> {
    for (const file of files) {
      const videoId = file.id as string;
      const updateData: Record<string, unknown> = {
        title: file.title,
        description: file.description,
        categoryId: file.categoryId,
        defaultLanguage: file.defaultLanguage,
        tags: file.tags,
      };

      if (Object.values(updateData).some((value) => value !== undefined)) {
        await this.apiClient.updateVideo(videoId, updateData);
      }

      if (file.transcript && file.transcriptId) {
        try {
          await this.apiClient.updateTranscript(videoId, file.transcriptId as string, file.transcript as string);
        } catch (error) {
          console.warn(`Failed to update transcript for video ${videoId}:`, error);
        }
      }
    }
  }

  /**
   * YouTube doesn't support deleting videos through the API.
   * Videos must be deleted through the YouTube interface.
   */
  deleteRecords(_tableSpec: BaseJsonTableSpec, _files: ConnectorFile[]): Promise<void> {
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
        // dates should be coming in as ISO 8601 format in UTC
        publishedAt: youtubeRecord.snippet?.publishedAt ? new Date(youtubeRecord.snippet.publishedAt) : null,
        transcript: '', // Empty transcript - will be fetched via pullRecordDeep
        visibility: youtubeRecord.status?.privacyStatus || '',
        categoryId: youtubeRecord.snippet?.categoryId || '',
        defaultLanguage: youtubeRecord.snippet?.defaultLanguage || '',
        tags: youtubeRecord.snippet?.tags || [],
        studioUrl: `https://studio.youtube.com/video/${videoId}/edit`,
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

  extractConnectorErrorDetails(error: unknown): ConnectorErrorDetails {
    // TODO - parse the error more gracefully and return more specific error details.

    return {
      userFriendlyMessage: 'An error occurred while connecting to YouTube',
      description: error instanceof Error ? error.message : String(error),
    };
  }
}
