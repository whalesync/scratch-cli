import { Service } from '@prisma/client';
import type { DraftPost, ListDraftPostsResponse } from '@wix/auto_sdk_blog_draft-posts';
import { draftPosts } from '@wix/blog';
import { members } from '@wix/members';
import { createClient, OAuthStrategy, TokenRole } from '@wix/sdk';
import _ from 'lodash';
import MarkdownIt from 'markdown-it';
import type { SnapshotColumnSettingsMap } from 'src/snapshot/types';
import { JsonSafeObject, JsonSafeValue } from 'src/utils/objects';
import TurndownService from 'turndown';
import { Connector } from '../../../connector';
import { ConnectorErrorDetails, ConnectorRecord, TablePreview } from '../../../types';
import { WixBlogTableSpec } from '../../custom-spec-registry';
import { HtmlToWixConverter } from '../rich-content/html-to-ricos';
import { WixToHtmlConverter } from '../rich-content/ricos-to-html';
import { WixDocument } from '../rich-content/types';
import { WixBlogSchemaParser } from './wix-blog-schema-parser';
import { WixAuthor } from './wix-blog-spec-types';

export const WIX_DEFAULT_BATCH_SIZE = 100; // Wix API supports up to 100

export class WixBlogConnector extends Connector<typeof Service.WIX_BLOG> {
  service = Service.WIX_BLOG;
  private readonly htmlToRicosConverter = new HtmlToWixConverter();
  private readonly ricosToHtmlConverter = new WixToHtmlConverter();
  private readonly turndownService: TurndownService = new TurndownService({
    headingStyle: 'atx',
  });
  private readonly wixClient: ReturnType<
    typeof createClient<
      undefined,
      ReturnType<typeof OAuthStrategy>,
      { draftPosts: typeof draftPosts; members: typeof members }
    >
  >;
  private readonly schemaParser = new WixBlogSchemaParser();

  constructor(accessToken: string) {
    super();
    this.wixClient = createClient({
      auth: OAuthStrategy({
        clientId: '', // Not needed for just using access tokens
        tokens: {
          accessToken: {
            value: accessToken,
            expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes from now (Wix tokens expire in 5 minutes)
          },
          refreshToken: {
            value: '',
            role: TokenRole.NONE,
          },
        },
      }),
      modules: {
        draftPosts,
        members,
      },
    });
  }

  displayName(): string {
    return 'Wix Blog';
  }

  public async testConnection(): Promise<void> {
    // Test that we have access to the draft posts API and that the creds work.
    await this.wixClient.draftPosts.listDraftPosts({
      paging: { limit: 1, offset: 0 },
    });
  }

  /**
   * Fetch the default blog author member ID
   */
  private async fetchDefaultBlogAuthorMemberId(): Promise<WixAuthor[]> {
    // TODO: we can add pagination if we need to at some point. for now it's an overkill i don't expect people to have 100+ authors.
    const members = await this.wixClient.members.queryMembers().find();

    // Convert Member[] to JSON-safe format (only include serializable fields)
    return members.items.map((member) => ({
      id: member._id,
      email: member.loginEmail,
    }));
  }

  async listTables(): Promise<TablePreview[]> {
    return Promise.resolve([this.schemaParser.parseTablePreview()]);
  }

  async fetchTableSpec(): Promise<WixBlogTableSpec> {
    const authors = await this.fetchDefaultBlogAuthorMemberId();
    const defaultSchema = this.schemaParser.parseTableSpec();
    return {
      ...defaultSchema,
      wixAuthors: authors,
    };
  }

  public downloadRecordDeep = undefined;

  async downloadTableRecords(
    tableSpec: WixBlogTableSpec,
    columnSettingsMap: SnapshotColumnSettingsMap,
    callback: (params: { records: ConnectorRecord[]; connectorProgress?: JsonSafeObject }) => Promise<void>,
  ): Promise<void> {
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      // Use SDK to list draft posts with rich content fieldset
      const response: ListDraftPostsResponse = await this.wixClient.draftPosts.listDraftPosts({
        paging: {
          limit: WIX_DEFAULT_BATCH_SIZE,
          offset: offset,
        },
        fieldsets: ['RICH_CONTENT'],
      });

      const posts = response.draftPosts || [];

      if (posts.length === 0) {
        hasMore = false;
        break;
      }

      const records = this.wireToConnectorRecord(posts, tableSpec, columnSettingsMap);
      await callback({ records });

      // Check pagination
      const metaData = response.metaData;
      if (metaData && metaData.total !== undefined) {
        offset += posts.length;
        hasMore = offset < metaData.total;
      } else {
        // If no pagination info, assume we're done if we got less than limit
        hasMore = posts.length === WIX_DEFAULT_BATCH_SIZE;
        offset += posts.length;
      }
    }
  }

  // Convert Wix draft posts to ConnectorRecords with fields keyed by wsId
  private wireToConnectorRecord(
    posts: DraftPost[],
    tableSpec: WixBlogTableSpec,
    columnSettingsMap: SnapshotColumnSettingsMap,
  ): ConnectorRecord[] {
    return posts.map((post) => {
      const { _id, ...fields } = post;
      const record: ConnectorRecord = {
        id: _id || '',
        fields: {},
        metadata: {},
      };

      for (const column of tableSpec.columns) {
        const fieldId = column.id.remoteId[0];

        const fieldValue = _.get(fields, fieldId) as JsonSafeValue;

        if (fieldValue !== undefined) {
          // Handle rich content conversion using proper Ricos converters
          if (column.wixFieldType === 'RichText') {
            const dataConverter = columnSettingsMap[column.id.wsId]?.dataConverter;
            if (dataConverter === 'wix') {
              record.fields[fieldId] = fieldValue as string;
            } else {
              const convertedRicos = this.ricosToHtmlConverter.convert(fieldValue as WixDocument);
              if (dataConverter === 'html') {
                // Convert Ricos format to HTML
                record.fields[fieldId] = convertedRicos;
              } else {
                // Convert to Markdown (Ricos -> HTML -> Markdown)
                record.fields[fieldId] = this.turndownService.turndown(convertedRicos);
              }
            }
          } else {
            record.fields[fieldId] = fieldValue;
          }
        }
      }

      return record;
    });
  }

  getBatchSize(): number {
    return 1;
  }

  async createRecords(
    tableSpec: WixBlogTableSpec,
    columnSettingsMap: SnapshotColumnSettingsMap,
    records: { wsId: string; fields: Record<string, unknown> }[],
  ): Promise<{ wsId: string; remoteId: string }[]> {
    const results: { wsId: string; remoteId: string }[] = [];

    // Wix doesn't support bulk create for posts, so we create one at a time
    for (const record of records) {
      const draftPostData = this.wsFieldsToWixPost(record.fields, tableSpec, columnSettingsMap);

      // Create draft post with default author using SDK
      const response = await this.wixClient.draftPosts.createDraftPost(
        {
          ...draftPostData,
          // TODO: we can add a table setting so the user can select the default author, or maybe add an extra column with options?
          // for now just defaulting to the first author should be fine for most cases.
          memberId: tableSpec.wixAuthors?.[0].id, // Set default author
        } as DraftPost,
        {
          fieldsets: ['RICH_CONTENT'],
        },
      );

      const draftPostId = response.draftPost?._id;

      if (!draftPostId) {
        throw new Error('Failed to create draft post: no ID returned');
      }

      results.push({
        wsId: record.wsId,
        remoteId: draftPostId,
      });
    }

    return results;
  }

  async updateRecords(
    tableSpec: WixBlogTableSpec,
    columnSettingsMap: SnapshotColumnSettingsMap,
    records: {
      id: { wsId: string; remoteId: string };
      partialFields: Record<string, unknown>;
    }[],
  ): Promise<void> {
    // Wix doesn't support bulk update, so we update one at a time
    for (const record of records) {
      const postData = this.wsFieldsToWixPost(record.partialFields, tableSpec, columnSettingsMap);

      // Update the draft post using SDK
      await this.wixClient.draftPosts.updateDraftPost(record.id.remoteId, postData as DraftPost, {
        fieldsets: ['RICH_CONTENT'],
      });
    }
  }

  async deleteRecords(tableSpec: WixBlogTableSpec, recordIds: { wsId: string; remoteId: string }[]): Promise<void> {
    // Wix doesn't support bulk delete, so we delete one at a time
    for (const recordId of recordIds) {
      // Delete the draft post permanently using SDK
      await this.wixClient.draftPosts.deleteDraftPost(recordId.remoteId, {
        permanent: true, // Permanently delete instead of moving to trash
      });
    }
  }

  // Convert internal fields (keyed by wsId) to Wix post format
  private wsFieldsToWixPost(
    wsFields: Record<string, unknown>,
    tableSpec: WixBlogTableSpec,
    columnSettingsMap: SnapshotColumnSettingsMap,
  ): Record<string, unknown> {
    const wixPost: Record<string, unknown> = {};

    for (const column of tableSpec.columns) {
      const wsValue = wsFields[column.id.wsId];
      if (wsValue !== undefined) {
        const fieldId = column.id.remoteId[0];

        // Handle rich content conversion using proper Ricos converters
        if (fieldId === 'richContent' && column.wixFieldType === 'RichText') {
          const dataConverter = columnSettingsMap[column.id.wsId]?.dataConverter;
          let html: string = '';
          if (dataConverter === 'wix') {
            wixPost[fieldId] = wsValue as string;
          } else {
            if (dataConverter === 'html') {
              html = wsValue as string;
            } else {
              // Convert markdown to HTML
              html = MarkdownIt({}).render(wsValue as string);
            }
            // Convert HTML to Ricos format using proper converter
            wixPost[fieldId] = this.htmlToRicosConverter.convert(html);
          }
        } else {
          wixPost[fieldId] = wsValue;
        }
      }
    }

    return wixPost;
  }

  extractConnectorErrorDetails(error: unknown): ConnectorErrorDetails {
    let userFriendlyMessage = 'An error occurred while connecting to Wix';
    let description = error instanceof Error ? error.message : String(error);
    let statusCode: number | undefined;
    // TODO: we can probably do much better than this.
    // Handle SDK/Fetch errors
    if (error && typeof error === 'object') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const err = error as any;

      // Check if it's a Response object or has response info
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (err.response) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        statusCode = err.response.status;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const errorData = err.response.data || err.data;

        if (errorData) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (errorData.message) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            userFriendlyMessage = errorData.message;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            description = errorData.message;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          } else if (errorData.details) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (typeof errorData.details === 'string') {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
              userFriendlyMessage = errorData.details;
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
              description = errorData.details;
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            } else if (errorData.details.applicationError) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              userFriendlyMessage =
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                errorData.details.applicationError.description || errorData.details.applicationError.code;
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              description = JSON.stringify(errorData.details.applicationError);
            }
          }
        }
      }

      // Handle status code from error object
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (err.status || err.statusCode) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        statusCode = err.status || err.statusCode;
      }

      // Apply status-specific messages
      if (statusCode === 401) {
        userFriendlyMessage = 'Authentication failed. Please reconnect your Wix account.';
      } else if (statusCode === 403) {
        userFriendlyMessage = 'Permission denied. Please check your Wix app permissions.';
      } else if (statusCode === 404) {
        userFriendlyMessage = 'Resource not found. The post or site may have been deleted.';
      } else if (statusCode === 429) {
        userFriendlyMessage = 'Rate limit exceeded. Please try again in a few minutes.';
      } else if (statusCode === 400) {
        userFriendlyMessage = 'Invalid request. Please check your data and try again.';
      }
    }

    return {
      userFriendlyMessage,
      description,
      additionalContext: statusCode ? { statusCode } : undefined,
    };
  }
}
