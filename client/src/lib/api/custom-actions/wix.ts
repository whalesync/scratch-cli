import { API_CONFIG } from '../config';
import { handleAxiosError } from '../error';

export interface WixPublishDraftPostsDto {
  snapshotTableId: string;
  recordIds: string[];
}

export interface PublishDraftPostsResponse {
  publishedPostIds?: string[];
  errors?: Array<{
    draftPostId?: string;
    message?: string;
  }>;
}

/**
 * Custom actions API for Wix Blog connector
 */
export const customWixActionsApi = {
  /**
   * Publish draft posts in Wix Blog
   */
  publishDraftPosts: async (dto: WixPublishDraftPostsDto): Promise<PublishDraftPostsResponse> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<PublishDraftPostsResponse>('/custom-actions/wix/publish-draft-posts', dto);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to publish draft posts');
    }
  },
};
