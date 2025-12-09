import { API_CONFIG } from '../config';
import { handleAxiosError } from '../error';

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
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<PublishItemsResponse>('/custom-actions/webflow/publish-items', dto);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to publish items');
    }
  },

  /**
   * Publish a Webflow site to one or more domains
   */
  publishSite: async (dto: WebflowPublishSiteDto): Promise<PublishSiteResponse> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<PublishSiteResponse>('/custom-actions/webflow/publish-site', dto);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to publish site');
    }
  },
};
