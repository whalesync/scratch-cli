/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { youtube, youtube_v3 } from '@googleapis/youtube';
// import { SyncProblem, SyncProblemCode } from '../types/sync-problem';
export class YoutubeApiClient {
  youtubeClient!: youtube_v3.Youtube;
  constructor(private readonly accessToken: string) {
    this.youtubeClient = youtube({ version: 'v3', headers: { Authorization: `Bearer ${this.accessToken}` } });
  }

  async getChannels(): Promise<youtube_v3.Schema$ChannelListResponse> {
    const channelResponse = await this.youtubeClient.channels.list({
      part: ['id', 'snippet'],
      mine: true,
      maxResults: 100,
    });
    return channelResponse.data;
  }

  async getChannelsByIds(channelIds: string[]): Promise<youtube_v3.Schema$ChannelListResponse> {
    const channelResponse = await this.youtubeClient.channels.list({
      part: ['id', 'snippet'],
      id: channelIds,
      maxResults: 100,
    });
    return channelResponse.data;
  }

  async getVideos(channelId: string, nextPageToken?: string): Promise<youtube_v3.Schema$VideoListResponse> {
    // Get videos from the specified channel (user's channel or brand channel they manage)
    // First, get the channel's uploads playlist ID
    const channelResponse = await this.youtubeClient.channels.list({
      part: ['contentDetails'],
      id: [channelId],
    });

    const uploadsPlaylistId = channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) {
      throw new Error(`Could not find uploads playlist for channel ${channelId}`);
    }

    // Get videos from the uploads playlist (includes private videos)
    const playlistResponse = await this.youtubeClient.playlistItems.list({
      part: ['snippet'],
      playlistId: uploadsPlaylistId,
      maxResults: 100,
      pageToken: nextPageToken,
    });

    if (!playlistResponse.data.items || playlistResponse.data.items.length === 0) {
      return {
        items: [],
        nextPageToken: playlistResponse.data.nextPageToken,
        prevPageToken: playlistResponse.data.prevPageToken,
        pageInfo: playlistResponse.data.pageInfo,
        kind: 'youtube#videoListResponse',
        etag: playlistResponse.data.etag,
      } as youtube_v3.Schema$VideoListResponse;
    }

    // Get video IDs from playlist items
    const videoIds: string[] = [];
    for (const item of playlistResponse.data.items) {
      const videoId = item.snippet?.resourceId?.videoId;
      if (typeof videoId === 'string') {
        videoIds.push(videoId);
      }
    }

    if (videoIds.length === 0) {
      return {
        items: [],
        nextPageToken: playlistResponse.data.nextPageToken,
        prevPageToken: playlistResponse.data.prevPageToken,
        pageInfo: playlistResponse.data.pageInfo,
        kind: 'youtube#videoListResponse',
        etag: playlistResponse.data.etag,
      } as youtube_v3.Schema$VideoListResponse;
    }

    // Get full video details including statistics and status
    const videosResponse = await this.youtubeClient.videos.list({
      part: ['snippet', 'id', 'statistics', 'status'],
      id: videoIds,
    });

    // Return with pagination info from playlist
    return {
      items: videosResponse.data.items || [],
      nextPageToken: playlistResponse.data.nextPageToken,
      prevPageToken: playlistResponse.data.prevPageToken,
      pageInfo: playlistResponse.data.pageInfo,
      kind: 'youtube#videoListResponse',
      etag: playlistResponse.data.etag,
    } as youtube_v3.Schema$VideoListResponse;
  }

  async getVideo(videoId: string): Promise<youtube_v3.Schema$VideoListResponse> {
    const searchResponse = await this.youtubeClient.videos.list({
      part: ['snippet', 'id', 'statistics', 'status'],
      id: [videoId],
    });
    return searchResponse.data;
  }

  // Somehow youtube forces you to send the category of the video to update it.
  async updateVideo(videoId: string, snippet: object): Promise<youtube_v3.Schema$Video> {
    const searchResponse = await this.youtubeClient.videos.update({
      part: ['snippet', 'id'],
      requestBody: {
        id: videoId,
        snippet,
      },
    });
    return searchResponse.data;
  }

  async getVideoTranscript(videoId: string): Promise<{ text: string; id: string | null }> {
    try {
      // List available caption tracks for the video
      const captionListResponse = await this.youtubeClient.captions.list({
        part: ['snippet'],
        videoId: videoId,
      });

      // Find the English caption track
      let captionId: string | null = null;
      if (captionListResponse.data.items) {
        for (const item of captionListResponse.data.items) {
          if (item.snippet?.language === 'en') {
            captionId = item.id || null;
            break;
          }
        }
      }

      if (!captionId) {
        console.debug(`No English transcript found for video ${videoId}`);
        return {
          text: `No English transcript found for video ${videoId}`,
          id: null,
        };
      }

      // Download the transcript
      const transcriptResponse = await this.youtubeClient.captions.download({
        id: captionId,
        tfmt: 'srt',
      });

      if (!transcriptResponse.data) {
        return {
          text: `No English transcript found for video ${videoId}`,
          id: null,
        };
      }

      // The response is a Blob, we need to convert it to string
      // Convert Blob to ArrayBuffer, then to Buffer, then to string
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const blob = transcriptResponse.data as any; // Type assertion for Blob
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const transcript = buffer.toString('utf-8');
      return { text: transcript, id: captionId };
    } catch (error: any) {
      // Handle specific error cases
      if (typeof error === 'object' && 'status' in error) {
        if (error.status === 403) {
          return { text: `Access denied for transcript of video ${videoId}`, id: null };
        } else if (error.status === 404) {
          return { text: `No captions found for video ${videoId}`, id: null };
        }
      }

      return {
        text: `Error fetching transcript for video ${videoId}: ${error?.message ?? 'Unknown error'}`,
        id: null,
      };
    }
  }

  async updateTranscript(transcriptId: string, transcriptText: string): Promise<void> {
    try {
      // First, we need to get the caption track details to update it
      const captionResponse = await this.youtubeClient.captions.list({
        part: ['snippet'],
        id: [transcriptId],
      });

      if (!captionResponse.data.items || captionResponse.data.items.length === 0) {
        throw new Error(`Transcript with ID ${transcriptId} not found`);
      }

      const caption = captionResponse.data.items[0];
      if (!caption.snippet) {
        throw new Error(`Transcript ${transcriptId} has no snippet data`);
      }

      // Convert the transcript text to a Buffer for upload
      const transcriptBuffer = Buffer.from(transcriptText, 'utf-8');

      // Update the caption track with the new content
      await this.youtubeClient.captions.update({
        part: ['snippet'],
        requestBody: {
          id: transcriptId,
          snippet: {
            ...caption.snippet,
            // Keep the existing snippet data but update the content
          },
        },
        media: {
          mimeType: 'text/plain',
          body: transcriptBuffer,
        },
      });
    } catch (error: any) {
      if (typeof error === 'object' && 'status' in error) {
        if (error.status === 403) {
          throw new Error(`Access denied for updating transcript ${transcriptId}`);
        } else if (error.status === 404) {
          throw new Error(`Transcript ${transcriptId} not found`);
        }
      }
      throw new Error(`Error updating transcript ${transcriptId}: ${error?.message ?? 'Unknown error'}`);
    }
  }
}
