import { Webflow, WebflowClient } from 'webflow-api';
import { WebflowTableSpec } from '../custom-spec-registry';

export interface PublishItemsParams {
  tableSpec: WebflowTableSpec;
  records: { wsId: string; remoteId: string }[];
}

export interface PublishSiteParams {
  tableSpec: WebflowTableSpec;
}

/**
 * Custom actions for Webflow connector.
 * Provides additional operations beyond standard CRUD operations.
 * These will be called in from the custom-actions service from Rest API endpoints called specifically from the client.
 */
export class WebflowCustomActions {
  private readonly client: WebflowClient;

  constructor(accessToken: string) {
    this.client = new WebflowClient({ accessToken });
  }

  /**
   * Publishes a single item or multiple items in a collection.
   * Items must already exist and be in draft state.
   *
   * @param params - Publish items parameters
   * @param params.tableSpec - The Webflow table spec containing collection metadata
   * @param params.records - Array of records to publish with wsId and remoteId
   * @returns Response containing published item IDs and any errors
   */
  async publishItems(params: PublishItemsParams): Promise<Webflow.collections.ItemsPublishItemResponse> {
    const { tableSpec, records } = params;
    const [, collectionId] = tableSpec.id.remoteId;

    const itemIds = records.map((record) => record.remoteId);

    const response = await this.client.collections.items.publishItem(collectionId, {
      itemIds,
    });

    return response;
  }

  /**
   * Publishes a Webflow site to one or more domains.
   *
   * @param params - Publish site parameters
   * @param params.siteId - The Webflow site ID
   * @param params.customDomains - Optional array of custom domain IDs to publish to
   * @param params.publishToWebflowSubdomain - Whether to publish to the Webflow subdomain
   * @returns Response containing publish queue information
   */
  async publishSite(params: PublishSiteParams): Promise<Webflow.SitesPublishResponse> {
    const { tableSpec } = params;
    const [siteId] = tableSpec.id.remoteId;
    const response = await this.client.sites.publish(siteId, {
      customDomains: [],
      publishToWebflowSubdomain: true,
    });

    return response;
  }
}
