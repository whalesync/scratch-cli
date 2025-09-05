/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
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
  async updateVideo(videoId: string, values: object, categoryId: string): Promise<youtube_v3.Schema$Video> {
    const searchResponse = await this.youtubeClient.videos.update({
      part: ['snippet', 'id'],
      requestBody: {
        id: videoId,
        snippet: {
          categoryId,
          ...values,
        },
      },
    });
    return searchResponse.data;
  }

  async getVideoTranscript(videoId: string): Promise<string | null> {
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
        return null;
      }

      // Download the transcript
      const transcriptResponse = await this.youtubeClient.captions.download({
        id: captionId,
        tfmt: 'srt',
      });

      // The response is a stream, we need to convert it to string
      if (transcriptResponse.data) {
        return transcriptResponse.data as string;
      }

      return null;
    } catch (error: any) {
      // Handle specific error cases
      if (error?.status === 403) {
        console.debug(
          `Access denied for transcript of video ${videoId}. This may be due to insufficient OAuth scope or video permissions.`,
        );
      } else if (error?.status === 404) {
        console.debug(`No captions found for video ${videoId}`);
      } else {
        console.debug(`Error fetching transcript for video ${videoId}:`, error);
      }
      return null;
    }
  }
}
