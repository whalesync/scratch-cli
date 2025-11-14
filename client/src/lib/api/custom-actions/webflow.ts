import { API_CONFIG } from '../config';
import { checkForApiError } from '../error';

export interface WebflowPublishItemsDto {
  snapshotTableId: string;
  recordIds: string[];
}

export interface WebflowPublishSiteDto {
  snapshotTableId: string;
}

export interface PublishItemsResponse {
  publishedItemIds?: string[];
  errors?: Array<{
    itemId?: string;
    message?: string;
  }>;
}

export interface PublishSiteResponse {
  queued?: boolean;
}

/**
 * Custom actions API for Webflow connector
 */
export const customWebflowActionsApi = {
  /**
   * Publish items in a Webflow collection
   */
  publishItems: async (dto: WebflowPublishItemsDto): Promise<PublishItemsResponse> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/custom-actions/webflow/publish-items`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    });
    await checkForApiError(res, 'Failed to publish items');
    return res.json();
  },

  /**
   * Publish a Webflow site to one or more domains
   */
  publishSite: async (dto: WebflowPublishSiteDto): Promise<PublishSiteResponse> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/custom-actions/webflow/publish-site`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    });
    await checkForApiError(res, 'Failed to publish site');
    return res.json();
  },
};
