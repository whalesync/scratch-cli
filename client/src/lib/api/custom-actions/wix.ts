import { API_CONFIG } from '../config';
import { checkForApiError } from '../error';

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
    const res = await fetch(`${API_CONFIG.getApiUrl()}/custom-actions/wix/publish-draft-posts`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    });
    await checkForApiError(res, 'Failed to publish draft posts');
    return res.json();
  },
};
