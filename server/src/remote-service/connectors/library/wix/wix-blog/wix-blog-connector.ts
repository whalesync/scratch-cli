import { Service } from '@spinner/shared-types';
import type { DraftPost } from '@wix/auto_sdk_blog_draft-posts';
import { draftPosts } from '@wix/blog';
import { members } from '@wix/members';
import { createClient, OAuthStrategy, TokenRole } from '@wix/sdk';
import _ from 'lodash';
import { WSLogger } from 'src/logger';
import { MarkdownErrors } from 'src/remote-service/connectors/markdown-errors';
import { JsonSafeObject, JsonSafeValue } from 'src/utils/objects';
import type { SnapshotColumnSettingsMap } from 'src/workbook/types';
import { Connector } from '../../../connector';
import {
  BaseJsonTableSpec,
  ConnectorErrorDetails,
  ConnectorFile,
  ConnectorRecord,
  EntityId,
  TablePreview,
} from '../../../types';
import { WixBlogTableSpec } from '../../custom-spec-registry';
import { HtmlToWixConverter } from '../rich-content/html-to-ricos';
import { createMarkdownParser, createTurndownService } from '../rich-content/markdown-helpers';
import { WixToHtmlConverter } from '../rich-content/ricos-to-html';
import { WixDocument } from '../rich-content/types';
import { buildWixBlogJsonTableSpec } from './wix-blog-json-schema';
import { WixBlogSchemaParser } from './wix-blog-schema-parser';

export const WIX_DEFAULT_BATCH_SIZE = 100; // Wix API supports up to 100

export class WixBlogConnector extends Connector<typeof Service.WIX_BLOG> {
  readonly service = Service.WIX_BLOG;
  static readonly displayName = 'Wix Blog';

  private readonly htmlToRicosConverter = new HtmlToWixConverter();
  private readonly ricosToHtmlConverter = new WixToHtmlConverter();
  private readonly turndownService = createTurndownService();
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

  public async testConnection(): Promise<void> {
    // Test that we have access to the draft posts API and that the creds work.
    await this.wixClient.draftPosts.listDraftPosts({
      paging: { limit: 1, offset: 0 },
    });
  }

  async listTables(): Promise<TablePreview[]> {
    return Promise.resolve([this.schemaParser.parseTablePreview()]);
  }

  /**
   * Fetch JSON Table Spec for Wix Blog draft posts.
   * Returns a schema describing the raw Wix DraftPost API response format.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async fetchJsonTableSpec(_id: EntityId): Promise<BaseJsonTableSpec> {
    void _id; // Wix Blog has only one table, so id is unused
    const id = this.schemaParser.parseTablePreview().id;
    return buildWixBlogJsonTableSpec(id);
  }

  public pullRecordDeep = undefined;

  async pullRecordFiles(
    tableSpec: BaseJsonTableSpec,
    callback: (params: { files: ConnectorFile[]; connectorProgress?: JsonSafeObject }) => Promise<void>,
    progress: JsonSafeObject,
  ): Promise<void> {
    WSLogger.info({ source: 'WixBlogConnector', message: 'pullRecordFiles called', tableId: tableSpec.id.wsId });
    await callback({ files: [], connectorProgress: progress });
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
                // TODO: This is a top-level generic warning about the content being lost. We should add a more
                // specific warning for the actual nodes that are lost and remove this.
                record.errors = MarkdownErrors.addFieldFidelityWarning(record.errors, fieldId, 'Wix');
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

  /**
   * Create draft posts in Wix from raw JSON files.
   * Files should contain Wix draft post data in the raw API format.
   * Returns the created posts.
   */
  async createRecords(
    _tableSpec: BaseJsonTableSpec,
    _columnSettingsMap: SnapshotColumnSettingsMap,
    files: ConnectorFile[],
  ): Promise<ConnectorFile[]> {
    const results: ConnectorFile[] = [];

    // Wix doesn't support bulk create for posts, so we create one at a time
    for (const file of files) {
      const draftPostData = file as unknown as DraftPost;

      const response = await this.wixClient.draftPosts.createDraftPost(draftPostData, {
        fieldsets: ['RICH_CONTENT'],
      });

      if (!response.draftPost?._id) {
        throw new Error('Failed to create draft post: no ID returned');
      }

      results.push(response.draftPost as unknown as ConnectorFile);
    }

    return results;
  }

  /**
   * Update draft posts in Wix from raw JSON files.
   * Files should have an '_id' field and the post data to update.
   */
  async updateRecords(
    _tableSpec: BaseJsonTableSpec,
    _columnSettingsMap: SnapshotColumnSettingsMap,
    files: ConnectorFile[],
  ): Promise<void> {
    // Wix doesn't support bulk update, so we update one at a time
    for (const file of files) {
      const postId = (file._id || file.id) as string;
      const postData = file as unknown as DraftPost;

      await this.wixClient.draftPosts.updateDraftPost(postId, postData, {
        fieldsets: ['RICH_CONTENT'],
      });
    }
  }

  /**
   * Delete draft posts from Wix.
   * Files should have an '_id' or 'id' field with the post ID to delete.
   */
  async deleteRecords(_tableSpec: BaseJsonTableSpec, files: ConnectorFile[]): Promise<void> {
    // Wix doesn't support bulk delete, so we delete one at a time
    for (const file of files) {
      const postId = (file._id || file.id) as string;
      await this.wixClient.draftPosts.deleteDraftPost(postId, {
        permanent: true,
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
              // Convert markdown to HTML (preserves img tags)
              const md = createMarkdownParser();
              html = md.render(wsValue as string);
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
