import { type TSchema } from '@sinclair/typebox';
import { Service } from '@spinner/shared-types';
import { isAxiosError } from 'axios';
import { WSLogger } from 'src/logger';
import { JsonSafeObject } from 'src/utils/objects';
import type { SnapshotColumnSettingsMap } from 'src/workbook/types';
import { Connector } from '../../connector';
import { extractCommonDetailsFromAxiosError, extractErrorMessageFromAxiosError } from '../../error';
import {
  BaseJsonTableSpec,
  ConnectorErrorDetails,
  ConnectorFile,
  ConnectorRecord,
  EntityId,
  TablePreview,
} from '../../types';
import { ShopifyApiClient, ShopifyError } from './shopify-api-client';
import {
  buildArticleSchema,
  buildBlogSchema,
  buildCollectionSchema,
  buildCustomerSchema,
  buildFileSchema,
  buildMetaobjectSchema,
  buildOrderSchema,
  buildPageSchema,
  buildProductSchema,
} from './shopify-schemas';
import {
  ShopifyCredentials,
  ShopifyEntityType,
  ShopifyOrder,
  ShopifyProduct,
  ShopifyWritableEntityType,
} from './shopify-types';

type ShopifyTableSpec = import('../custom-spec-registry').TableSpecs[typeof Service.SHOPIFY];

const LOG_SOURCE = 'ShopifyConnector';

// ============= Entity Configuration =============

interface EntityConfig {
  displayName: string;
  description: string;
  slugColumnRemoteId?: string;
  titleColumnRemoteId?: string[];
  mainContentColumnRemoteId?: string[];
  buildSchema: () => TSchema;
}

const ENTITY_CONFIG: Record<ShopifyEntityType, EntityConfig> = {
  products: {
    displayName: 'Products',
    description: 'Products in your Shopify store',
    slugColumnRemoteId: 'handle',
    titleColumnRemoteId: ['title'],
    mainContentColumnRemoteId: ['products', 'descriptionHtml'],
    buildSchema: buildProductSchema,
  },
  collections: {
    displayName: 'Collections',
    description: 'Product collections',
    slugColumnRemoteId: 'handle',
    titleColumnRemoteId: ['title'],
    mainContentColumnRemoteId: ['collections', 'descriptionHtml'],
    buildSchema: buildCollectionSchema,
  },
  pages: {
    displayName: 'Pages',
    description: 'Static content pages',
    slugColumnRemoteId: 'handle',
    titleColumnRemoteId: ['title'],
    mainContentColumnRemoteId: ['pages', 'body'],
    buildSchema: buildPageSchema,
  },
  blogs: {
    displayName: 'Blogs',
    description: 'Blog channels',
    slugColumnRemoteId: 'handle',
    titleColumnRemoteId: ['title'],
    buildSchema: buildBlogSchema,
  },
  articles: {
    displayName: 'Articles',
    description: 'Blog articles',
    slugColumnRemoteId: 'handle',
    titleColumnRemoteId: ['title'],
    mainContentColumnRemoteId: ['articles', 'body'],
    buildSchema: buildArticleSchema,
  },
  customers: {
    displayName: 'Customers',
    description: 'Store customers (read-only)',
    titleColumnRemoteId: ['displayName'],
    buildSchema: buildCustomerSchema,
  },
  orders: {
    displayName: 'Orders',
    description: 'Store orders with line items (read-only)',
    titleColumnRemoteId: ['name'],
    buildSchema: buildOrderSchema,
  },
  files: {
    displayName: 'Files',
    description: 'Uploaded files and media (read-only)',
    slugColumnRemoteId: 'fileSlug',
    buildSchema: buildFileSchema,
  },
  metaobjects: {
    displayName: 'Metaobjects',
    description: 'Custom metaobject entries (read-only)',
    slugColumnRemoteId: 'handle',
    titleColumnRemoteId: ['displayName'],
    buildSchema: buildMetaobjectSchema,
  },
};

const ALL_ENTITY_TYPES = Object.keys(ENTITY_CONFIG) as ShopifyEntityType[];

/**
 * Read-only fields per entity type that must be stripped before create/update mutations.
 */
const READ_ONLY_FIELDS: Record<ShopifyWritableEntityType, Set<string>> = {
  products: new Set(['id', 'createdAt', 'updatedAt', 'description', 'variants', 'images', 'media']),
  collections: new Set(['id', 'updatedAt', 'description']),
  pages: new Set(['id', 'createdAt', 'updatedAt', 'bodySummary', 'publishedAt']),
  blogs: new Set(['id', 'createdAt', 'updatedAt']),
  articles: new Set(['id', 'createdAt', 'updatedAt', 'publishedAt']),
};

/**
 * Additional fields to strip on update (but keep on create).
 * Articles need blog.id for creation, but blog and author are not accepted on update.
 */
const STRIP_ON_UPDATE_FIELDS: Partial<Record<ShopifyWritableEntityType, Set<string>>> = {
  articles: new Set(['blog', 'author']),
};

const READ_ONLY_ENTITIES: Set<ShopifyEntityType> = new Set(['customers', 'orders', 'files', 'metaobjects']);

/**
 * Connector for the Shopify e-commerce platform.
 *
 * Supports full CRUD for Products, Collections, Pages, Blogs, Articles.
 * Read-only access for Customers, Orders, Files, Metaobjects.
 */
export class ShopifyConnector extends Connector<typeof Service.SHOPIFY> {
  readonly service = Service.SHOPIFY;
  static readonly displayName = 'Shopify';

  private readonly client: ShopifyApiClient;

  constructor(credentials: ShopifyCredentials) {
    super();
    this.client = new ShopifyApiClient(credentials);
  }

  /**
   * Test the connection by validating credentials.
   */
  async testConnection(): Promise<void> {
    await this.client.validateCredentials();
  }

  /**
   * List available tables - all 9 entity types.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async listTables(): Promise<TablePreview[]> {
    return ALL_ENTITY_TYPES.map((entityType) => {
      const config = ENTITY_CONFIG[entityType];
      return {
        id: { wsId: entityType, remoteId: [entityType] },
        displayName: config.displayName,
        metadata: {
          description: config.description,
        },
      };
    });
  }

  /**
   * Fetch the JSON Table Spec for a Shopify entity type.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async fetchJsonTableSpec(id: EntityId): Promise<BaseJsonTableSpec> {
    const entityType = id.wsId as ShopifyEntityType;
    const config = ENTITY_CONFIG[entityType];

    if (!config) {
      const supported = ALL_ENTITY_TYPES.join(', ');
      throw new ShopifyError(`Entity type '${id.wsId}' not found. Supported types: ${supported}`, 404);
    }

    const spec: BaseJsonTableSpec = {
      id,
      slug: entityType,
      name: config.displayName,
      schema: config.buildSchema(),
      idColumnRemoteId: 'id',
    };

    if (config.slugColumnRemoteId) {
      spec.slugColumnRemoteId = config.slugColumnRemoteId;
    }
    if (config.titleColumnRemoteId) {
      spec.titleColumnRemoteId = config.titleColumnRemoteId;
    }
    if (config.mainContentColumnRemoteId) {
      spec.mainContentColumnRemoteId = config.mainContentColumnRemoteId;
    }

    return spec;
  }

  /**
   * Pull records using the column-based method.
   * @throws Error - This connector only supports JSON schema methods.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async pullTableRecords(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _tableSpec: ShopifyTableSpec,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _columnSettingsMap: SnapshotColumnSettingsMap,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _callback: (params: { records: ConnectorRecord[]; connectorProgress?: JsonSafeObject }) => Promise<void>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _progress: JsonSafeObject,
  ): Promise<void> {
    throw new Error('Shopify connector does not support pullTableRecords. Use pullRecordFiles instead.');
  }

  /**
   * Pull all entities of the given type as JSON files, with hydration for products and orders.
   */
  async pullRecordFiles(
    tableSpec: BaseJsonTableSpec,
    callback: (params: { files: ConnectorFile[]; connectorProgress?: JsonSafeObject }) => Promise<void>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _progress: JsonSafeObject,
  ): Promise<void> {
    const entityType = tableSpec.id.wsId as ShopifyEntityType;
    const config = ENTITY_CONFIG[entityType];

    if (!config) {
      throw new ShopifyError(`Unsupported table: ${tableSpec.id.wsId}`, 400);
    }

    for await (const entities of this.client.listEntities(entityType)) {
      let files: ConnectorFile[];

      if (entityType === 'products') {
        // Hydrate product connections (variants, images, media)
        const hydrated: ConnectorFile[] = [];
        for (const entity of entities) {
          const product = await this.client.hydrateProductConnections(entity as unknown as ShopifyProduct);
          hydrated.push(product as unknown as ConnectorFile);
        }
        files = hydrated;
      } else if (entityType === 'orders') {
        // Hydrate order connections (lineItems, shippingLines)
        const hydrated: ConnectorFile[] = [];
        for (const entity of entities) {
          const order = await this.client.hydrateOrderConnections(entity as unknown as ShopifyOrder);
          hydrated.push(order as unknown as ConnectorFile);
        }
        files = hydrated;
      } else {
        files = entities as ConnectorFile[];
      }

      await callback({ files });
    }
  }

  public pullRecordDeep = undefined;

  /**
   * Get the batch size for CRUD operations.
   */
  getBatchSize(operation: 'create' | 'update' | 'delete'): number {
    return operation === 'delete' ? 1 : 10;
  }

  /**
   * Create records from JSON files.
   */
  async createRecords(
    tableSpec: BaseJsonTableSpec,
    _columnSettingsMap: SnapshotColumnSettingsMap,
    files: ConnectorFile[],
  ): Promise<ConnectorFile[]> {
    const entityType = tableSpec.id.wsId as ShopifyEntityType;
    this.assertWritable(entityType);
    const writableType = entityType as ShopifyWritableEntityType;

    const results: ConnectorFile[] = [];
    for (const file of files) {
      const input = this.stripReadOnlyFields(file, writableType);
      const created = await this.client.createEntity(writableType, input);
      results.push(created as ConnectorFile);
    }

    return results;
  }

  /**
   * Update records from JSON files.
   */
  async updateRecords(
    tableSpec: BaseJsonTableSpec,
    _columnSettingsMap: SnapshotColumnSettingsMap,
    files: ConnectorFile[],
  ): Promise<void> {
    const entityType = tableSpec.id.wsId as ShopifyEntityType;
    this.assertWritable(entityType);
    const writableType = entityType as ShopifyWritableEntityType;

    for (const file of files) {
      const entityId = String(file.id);
      const input = this.stripReadOnlyFields(file, writableType, 'update');
      await this.client.updateEntity(writableType, entityId, input);
    }
  }

  /**
   * Delete records.
   */
  async deleteRecords(tableSpec: BaseJsonTableSpec, files: ConnectorFile[]): Promise<void> {
    const entityType = tableSpec.id.wsId as ShopifyEntityType;
    this.assertWritable(entityType);
    const writableType = entityType as ShopifyWritableEntityType;

    for (const file of files) {
      try {
        await this.client.deleteEntity(writableType, String(file.id));
      } catch (error) {
        // Ignore 404s - the entity may already be deleted
        if (error instanceof ShopifyError && error.statusCode === 404) {
          WSLogger.warn({
            source: LOG_SOURCE,
            message: `${ENTITY_CONFIG[entityType].displayName} ${String(file.id)} already deleted, skipping`,
          });
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Assert that the entity type supports write operations.
   */
  private assertWritable(entityType: ShopifyEntityType): void {
    if (READ_ONLY_ENTITIES.has(entityType)) {
      throw new ShopifyError(
        `${ENTITY_CONFIG[entityType].displayName} are read-only and cannot be created, updated, or deleted`,
        400,
        'READ_ONLY',
      );
    }
  }

  /**
   * Strip read-only fields from a record before mutation.
   */
  private stripReadOnlyFields(
    file: ConnectorFile,
    entityType: ShopifyWritableEntityType,
    operation: 'create' | 'update' = 'create',
  ): Record<string, unknown> {
    const readOnly = READ_ONLY_FIELDS[entityType];
    const updateOnly = operation === 'update' ? STRIP_ON_UPDATE_FIELDS[entityType] : undefined;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(file)) {
      if (readOnly.has(key) || (updateOnly && updateOnly.has(key)) || value === undefined) {
        continue;
      }
      result[key] = value;
    }
    return result;
  }

  /**
   * Extract error details for user-friendly error reporting.
   */
  extractConnectorErrorDetails(error: unknown): ConnectorErrorDetails {
    if (error instanceof ShopifyError) {
      return {
        userFriendlyMessage: error.message,
        description: error.message,
        additionalContext: {
          status: error.statusCode,
          code: error.code,
          userErrors: error.userErrors,
        },
      };
    }

    if (isAxiosError(error)) {
      const commonError = extractCommonDetailsFromAxiosError(this, error);
      if (commonError) return commonError;

      return {
        userFriendlyMessage: extractErrorMessageFromAxiosError(this.service, error, ['message', 'error']),
        description: error.message,
        additionalContext: {
          status: error.response?.status,
        },
      };
    }

    return {
      userFriendlyMessage: 'An error occurred while connecting to Shopify',
      description: error instanceof Error ? error.message : String(error),
    };
  }
}
