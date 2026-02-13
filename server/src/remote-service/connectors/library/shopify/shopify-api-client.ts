/**
 * Shopify GraphQL Admin API Client
 *
 * Low-level client for the Shopify Admin GraphQL API using axios.
 * Includes retry with exponential backoff for rate-limited requests.
 *
 * API docs: https://shopify.dev/docs/api/admin-graphql
 */

import axios, { AxiosInstance } from 'axios';
import { WSLogger } from 'src/logger';
import {
  ShopifyArticle,
  ShopifyArticleInput,
  ShopifyBlog,
  ShopifyBlogInput,
  ShopifyCollection,
  ShopifyCollectionInput,
  ShopifyConnection,
  ShopifyCredentials,
  ShopifyCustomer,
  ShopifyEntityType,
  ShopifyFile,
  ShopifyGraphQLResponse,
  ShopifyMetaobject,
  ShopifyMetaobjectDefinition,
  ShopifyOrder,
  ShopifyPage,
  ShopifyPageInput,
  ShopifyPaginatedResponse,
  ShopifyProduct,
  ShopifyProductInput,
  ShopifyUserError,
  ShopifyWritableEntityType,
} from './shopify-types';

const LOG_SOURCE = 'ShopifyApiClient';

// GraphQL API version
const API_VERSION = '2025-01';

// Retry configuration for rate-limited requests
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;

// Owned connection fields to hydrate on products
const PRODUCT_OWNED_CONNECTIONS = ['variants', 'images', 'media'] as const;
// Owned connection fields to hydrate on orders
const ORDER_OWNED_CONNECTIONS = ['lineItems', 'shippingLines'] as const;
const HYDRATION_PAGE_SIZE = 25;

/**
 * Shopify API error
 */
export class ShopifyError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public userErrors?: ShopifyUserError[],
  ) {
    super(message);
    this.name = 'ShopifyError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalize a shop domain to the full myshopify.com format.
 */
function normalizeDomain(input: string): string {
  let domain = input.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, '');
  domain = domain.replace(/\/$/, '');
  if (!domain.includes('.myshopify.com')) {
    domain = `${domain}.myshopify.com`;
  }
  return domain;
}

// ============= GraphQL Query Fragments =============

const PRODUCT_FIELDS = `
  id handle title description descriptionHtml
  vendor productType status tags templateSuffix
  category { id name fullName }
  createdAt updatedAt
`;

const COLLECTION_FIELDS = `
  id handle title description descriptionHtml
  sortOrder templateSuffix updatedAt
`;

const PAGE_FIELDS = `
  id handle title body bodySummary
  isPublished publishedAt templateSuffix
  createdAt updatedAt
`;

const BLOG_FIELDS = `
  id handle title templateSuffix createdAt updatedAt
`;

const ARTICLE_FIELDS = `
  id handle title body summary
  author { name }
  tags isPublished publishedAt templateSuffix
  blog { id handle }
  createdAt updatedAt
`;

const CUSTOMER_FIELDS = `
  id firstName lastName displayName email phone
  state note verifiedEmail taxExempt tags
  amountSpent { amount currencyCode }
  numberOfOrders
  createdAt updatedAt
`;

const ORDER_FIELDS = `
  id name email phone
  customer { id displayName }
  totalPriceSet { shopMoney { amount currencyCode } }
  subtotalPriceSet { shopMoney { amount currencyCode } }
  totalShippingPriceSet { shopMoney { amount currencyCode } }
  totalTaxSet { shopMoney { amount currencyCode } }
  totalDiscountsSet { shopMoney { amount currencyCode } }
  displayFinancialStatus displayFulfillmentStatus
  tags note cancelledAt closedAt processedAt
  createdAt updatedAt
`;

const FILE_FIELDS = `
  ... on GenericFile {
    id alt fileStatus mimeType originalFileSize
    url createdAt updatedAt
  }
  ... on MediaImage {
    id alt fileStatus mimeType
    image { url }
    createdAt updatedAt
  }
  ... on Video {
    id alt fileStatus
    createdAt updatedAt
  }
`;

const METAOBJECT_FIELDS = `
  id handle type displayName
  fields { key value type }
  updatedAt
`;

// ============= GraphQL List Queries =============

const LIST_QUERIES: Record<string, string> = {
  products: `
    query ListProducts($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        nodes { ${PRODUCT_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }
  `,
  collections: `
    query ListCollections($first: Int!, $after: String) {
      collections(first: $first, after: $after) {
        nodes { ${COLLECTION_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }
  `,
  pages: `
    query ListPages($first: Int!, $after: String) {
      pages(first: $first, after: $after) {
        nodes { ${PAGE_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }
  `,
  blogs: `
    query ListBlogs($first: Int!, $after: String) {
      blogs(first: $first, after: $after) {
        nodes { ${BLOG_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }
  `,
  articles: `
    query ListArticles($first: Int!, $after: String) {
      articles(first: $first, after: $after) {
        nodes { ${ARTICLE_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }
  `,
  customers: `
    query ListCustomers($first: Int!, $after: String) {
      customers(first: $first, after: $after) {
        nodes { ${CUSTOMER_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }
  `,
  orders: `
    query ListOrders($first: Int!, $after: String) {
      orders(first: $first, after: $after) {
        nodes { ${ORDER_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }
  `,
  files: `
    query ListFiles($first: Int!, $after: String) {
      files(first: $first, after: $after) {
        nodes { ${FILE_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
    }
  `,
};

// ============= Order Hydration Queries =============

const ORDER_CONNECTION_FRAGMENTS: Record<string, string> = {
  lineItems: `
    lineItems(first: $first, after: $after) {
      nodes {
        id title quantity sku
        variant { id title }
        originalTotalSet { shopMoney { amount currencyCode } }
        discountedTotalSet { shopMoney { amount currencyCode } }
      }
      pageInfo { hasNextPage endCursor }
    }
  `,
  shippingLines: `
    shippingLines(first: $first, after: $after) {
      nodes {
        id title code
        originalPriceSet { shopMoney { amount currencyCode } }
        discountedPriceSet { shopMoney { amount currencyCode } }
      }
      pageInfo { hasNextPage endCursor }
    }
  `,
};

/**
 * Transform category from the stored object format to Shopify's mutation input format.
 * Queries return `category { id name fullName }`.
 * Mutations accept `category: ID` (a TaxonomyCategory GID string).
 */
function transformCategoryInput(input: ShopifyProductInput): Record<string, unknown> {
  const raw = { ...input } as Record<string, unknown>;
  const category = raw.category as { id?: string } | null | undefined;

  if (category === undefined) return raw;
  if (category === null) {
    raw.category = null;
    return raw;
  }

  raw.category = category.id ?? null;
  return raw;
}

/**
 * Shopify GraphQL API client.
 */
export class ShopifyApiClient {
  private readonly client: AxiosInstance;
  private readonly domain: string;

  constructor(credentials: ShopifyCredentials) {
    this.domain = normalizeDomain(credentials.shopDomain);

    this.client = axios.create({
      baseURL: `https://${this.domain}/admin/api/${API_VERSION}`,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': credentials.accessToken,
      },
    });
  }

  // ============= Core GraphQL Execution =============

  /**
   * Execute a GraphQL query/mutation with automatic retry on throttling.
   */
  private async query<T>(queryString: string, variables?: Record<string, unknown>): Promise<T> {
    let lastError: Error | null = null;
    let retryDelay = INITIAL_RETRY_DELAY_MS;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.executeQuery<T>(queryString, variables);
      } catch (error) {
        lastError = error as Error;

        const isThrottled =
          error instanceof ShopifyError &&
          (error.code === 'THROTTLED' || error.statusCode === 429 || error.message.toLowerCase().includes('throttle'));

        if (!isThrottled || attempt === MAX_RETRIES) {
          throw error;
        }

        WSLogger.warn({
          source: LOG_SOURCE,
          message: `Shopify API throttled, retrying in ${retryDelay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
        });
        await sleep(retryDelay);

        // Exponential backoff with jitter
        retryDelay = Math.min(retryDelay * 2 + Math.random() * 500, MAX_RETRY_DELAY_MS);
      }
    }

    // This should be unreachable, but satisfies the compiler
    throw lastError ?? new ShopifyError('Max retries exceeded', 429, 'THROTTLED');
  }

  /**
   * Execute a single GraphQL query/mutation (no retry).
   */
  private async executeQuery<T>(queryString: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await this.client.post<ShopifyGraphQLResponse<T>>('/graphql.json', {
      query: queryString,
      variables,
    });

    const result = response.data;

    if (result.errors && result.errors.length > 0) {
      const error = result.errors[0];
      const code = error.extensions?.code as string | undefined;
      throw new ShopifyError(error.message, 400, code);
    }

    if (!result.data) {
      throw new ShopifyError('No data returned from Shopify API', 500);
    }

    return result.data;
  }

  // ============= Connection Validation =============

  /**
   * Validate credentials by querying shop info.
   */
  async validateCredentials(): Promise<void> {
    try {
      await this.query<{ shop: { id: string; name: string } }>(`
        query { shop { id name } }
      `);
    } catch (error) {
      if (error instanceof ShopifyError && (error.statusCode === 401 || error.statusCode === 403)) {
        throw new ShopifyError('Invalid Shopify credentials', 401, 'UNAUTHORIZED');
      }
      throw error;
    }
  }

  // ============= Generic Paginated List =============

  /**
   * Fetch a single page of entities (generic helper).
   */
  private async fetchEntityPage<T>(
    queryString: string,
    rootField: string,
    cursor: string | null,
    pageSize: number,
  ): Promise<ShopifyPaginatedResponse<T>> {
    const data = await this.query<Record<string, ShopifyConnection<T>>>(queryString, {
      first: pageSize,
      after: cursor,
    });

    const connection: ShopifyConnection<T> | undefined = data[rootField];
    if (!connection) {
      return { data: [], pageInfo: { hasNextPage: false, endCursor: null } };
    }

    return {
      data: connection.nodes,
      pageInfo: connection.pageInfo,
    };
  }

  /**
   * Generic async generator that yields pages of entities.
   */
  private async *listEntitiesGeneric<T>(
    queryString: string,
    rootField: string,
    pageSize: number,
  ): AsyncGenerator<T[], void> {
    let cursor: string | null = null;
    let hasMore = true;

    while (hasMore) {
      const page: ShopifyPaginatedResponse<T> = await this.fetchEntityPage<T>(queryString, rootField, cursor, pageSize);

      if (page.data.length === 0) break;

      yield page.data;

      hasMore = page.pageInfo.hasNextPage;
      cursor = page.pageInfo.endCursor;
    }
  }

  // ============= Entity List Methods =============

  async *listProducts(pageSize = 50): AsyncGenerator<ShopifyProduct[], void> {
    yield* this.listEntitiesGeneric<ShopifyProduct>(LIST_QUERIES.products, 'products', pageSize);
  }

  async *listCollections(pageSize = 50): AsyncGenerator<ShopifyCollection[], void> {
    yield* this.listEntitiesGeneric<ShopifyCollection>(LIST_QUERIES.collections, 'collections', pageSize);
  }

  async *listPages(pageSize = 50): AsyncGenerator<ShopifyPage[], void> {
    yield* this.listEntitiesGeneric<ShopifyPage>(LIST_QUERIES.pages, 'pages', pageSize);
  }

  async *listBlogs(pageSize = 50): AsyncGenerator<ShopifyBlog[], void> {
    yield* this.listEntitiesGeneric<ShopifyBlog>(LIST_QUERIES.blogs, 'blogs', pageSize);
  }

  async *listArticles(pageSize = 50): AsyncGenerator<ShopifyArticle[], void> {
    yield* this.listEntitiesGeneric<ShopifyArticle>(LIST_QUERIES.articles, 'articles', pageSize);
  }

  async *listCustomers(pageSize = 50): AsyncGenerator<ShopifyCustomer[], void> {
    yield* this.listEntitiesGeneric<ShopifyCustomer>(LIST_QUERIES.customers, 'customers', pageSize);
  }

  async *listOrders(pageSize = 50): AsyncGenerator<ShopifyOrder[], void> {
    yield* this.listEntitiesGeneric<ShopifyOrder>(LIST_QUERIES.orders, 'orders', pageSize);
  }

  async *listFiles(pageSize = 50): AsyncGenerator<ShopifyFile[], void> {
    for await (const batch of this.listEntitiesGeneric<ShopifyFile>(LIST_QUERIES.files, 'files', pageSize)) {
      // Filter out files that didn't match any inline fragment (no id) and normalize
      const normalized = batch
        .filter((f) => f.id)
        .map((f) => {
          const raw = f as unknown as Record<string, unknown>;
          const file = { ...raw };
          // Normalize MediaImage nested url to top-level
          if (!file.url && raw.image) {
            file.url = (raw.image as { url?: string })?.url;
            delete file.image;
          }
          // Extract numeric ID from GID for safe filenames (gid://shopify/GenericFile/123 → 123)
          const gid = String(file.id);
          const numericId = gid.split('/').pop() || gid;
          file.fileSlug = numericId;
          return file as unknown as ShopifyFile;
        });
      if (normalized.length > 0) {
        yield normalized;
      }
    }
  }

  /**
   * List metaobjects across all types.
   * Metaobjects require a `type` argument, so we first fetch all definitions
   * then iterate each type.
   */
  async *listMetaobjects(pageSize = 50): AsyncGenerator<ShopifyMetaobject[], void> {
    const definitions = await this.listMetaobjectDefinitions();

    for (const def of definitions) {
      const metaobjectQuery = `
        query ListMetaobjects($type: String!, $first: Int!, $after: String) {
          metaobjects(type: $type, first: $first, after: $after) {
            nodes { ${METAOBJECT_FIELDS} }
            pageInfo { hasNextPage endCursor }
          }
        }
      `;

      let cursor: string | null = null;
      let hasMore = true;

      while (hasMore) {
        const page = await this.fetchMetaobjectPage(metaobjectQuery, def.type, cursor, pageSize);

        if (page.data.length === 0) break;

        yield page.data;

        hasMore = page.pageInfo.hasNextPage;
        cursor = page.pageInfo.endCursor;
      }
    }
  }

  private async fetchMetaobjectPage(
    queryString: string,
    type: string,
    cursor: string | null,
    pageSize: number,
  ): Promise<ShopifyPaginatedResponse<ShopifyMetaobject>> {
    const data = await this.query<{ metaobjects: ShopifyConnection<ShopifyMetaobject> }>(queryString, {
      type,
      first: pageSize,
      after: cursor,
    });

    if (!data.metaobjects) {
      return { data: [], pageInfo: { hasNextPage: false, endCursor: null } };
    }

    return {
      data: data.metaobjects.nodes,
      pageInfo: data.metaobjects.pageInfo,
    };
  }

  /**
   * Fetch all metaobject definitions (types) in the store.
   */
  private async listMetaobjectDefinitions(): Promise<ShopifyMetaobjectDefinition[]> {
    const allDefs: ShopifyMetaobjectDefinition[] = [];
    let cursor: string | null = null;
    let hasMore = true;

    const defQuery = `
      query ListMetaobjectDefinitions($first: Int!, $after: String) {
        metaobjectDefinitions(first: $first, after: $after) {
          nodes { id type name }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;

    while (hasMore) {
      const page: ShopifyPaginatedResponse<ShopifyMetaobjectDefinition> =
        await this.fetchEntityPage<ShopifyMetaobjectDefinition>(defQuery, 'metaobjectDefinitions', cursor, 50);

      if (page.data.length === 0) break;

      allDefs.push(...page.data);
      hasMore = page.pageInfo.hasNextPage;
      cursor = page.pageInfo.endCursor;
    }

    return allDefs;
  }

  // ============= Dispatch List Method =============

  /**
   * List entities by type (dispatch to specific list method).
   */
  async *listEntities(entityType: ShopifyEntityType, pageSize = 50): AsyncGenerator<Record<string, unknown>[], void> {
    switch (entityType) {
      case 'products':
        yield* this.listProducts(pageSize) as AsyncGenerator<Record<string, unknown>[]>;
        break;
      case 'collections':
        yield* this.listCollections(pageSize) as AsyncGenerator<Record<string, unknown>[]>;
        break;
      case 'pages':
        yield* this.listPages(pageSize) as AsyncGenerator<Record<string, unknown>[]>;
        break;
      case 'blogs':
        yield* this.listBlogs(pageSize) as AsyncGenerator<Record<string, unknown>[]>;
        break;
      case 'articles':
        yield* this.listArticles(pageSize) as AsyncGenerator<Record<string, unknown>[]>;
        break;
      case 'customers':
        yield* this.listCustomers(pageSize) as AsyncGenerator<Record<string, unknown>[]>;
        break;
      case 'orders':
        yield* this.listOrders(pageSize) as AsyncGenerator<Record<string, unknown>[]>;
        break;
      case 'files':
        yield* this.listFiles(pageSize) as AsyncGenerator<Record<string, unknown>[]>;
        break;
      case 'metaobjects':
        yield* this.listMetaobjects(pageSize) as AsyncGenerator<Record<string, unknown>[]>;
        break;
    }
  }

  // ============= Products - Hydration =============

  /**
   * Hydrate owned connections (variants, images, media) for a product.
   *
   * Attempts a batched query first. Falls back to individual queries
   * if the batched query exceeds the cost limit.
   */
  async hydrateProductConnections(product: ShopifyProduct): Promise<ShopifyProduct> {
    const hydrated = { ...product };

    try {
      await this.hydrateBatched(hydrated);
    } catch (error) {
      if (
        error instanceof ShopifyError &&
        (error.code === 'MAX_COST_EXCEEDED' || error.message.toLowerCase().includes('max cost'))
      ) {
        WSLogger.warn({
          source: LOG_SOURCE,
          message: `Batched hydration exceeded cost for product ${product.id}, falling back to individual queries`,
        });
        await this.hydrateIndividually(hydrated);
      } else {
        WSLogger.warn({
          source: LOG_SOURCE,
          message: `Failed to hydrate connections for product ${product.id}`,
          error: error instanceof Error ? error.message : String(error),
        });
        // Leave connections empty rather than failing the entire pull
      }
    }

    return hydrated;
  }

  /**
   * Hydrate all owned connections in a single batched query.
   */
  private async hydrateBatched(product: ShopifyProduct): Promise<void> {
    const data = await this.query<{ node: Record<string, unknown> | null }>(
      `
      query HydrateProduct($id: ID!, $first: Int!) {
        node(id: $id) {
          ... on Product {
            variants(first: $first) {
              nodes {
                id
                title
                sku
                price
                compareAtPrice
                inventoryQuantity
                barcode
                position
                taxable
                createdAt
                updatedAt
                selectedOptions {
                  name
                  value
                }
              }
              pageInfo { hasNextPage endCursor }
            }
            images(first: $first) {
              nodes {
                id
                url
                altText
                width
                height
              }
              pageInfo { hasNextPage endCursor }
            }
            media(first: $first) {
              nodes {
                ... on MediaImage {
                  id
                  alt
                  mediaContentType
                  status
                  image { url altText width height }
                }
                ... on Video {
                  id
                  alt
                  mediaContentType
                  status
                }
                ... on ExternalVideo {
                  id
                  alt
                  mediaContentType
                  status
                  embeddedUrl
                }
                ... on Model3d {
                  id
                  alt
                  mediaContentType
                  status
                }
              }
              pageInfo { hasNextPage endCursor }
            }
          }
        }
      }
    `,
      { id: product.id, first: HYDRATION_PAGE_SIZE },
    );

    if (!data.node) return;

    for (const field of PRODUCT_OWNED_CONNECTIONS) {
      const connectionData = data.node[field] as {
        nodes: Record<string, unknown>[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      } | null;

      if (!connectionData) continue;

      let allNodes = [...connectionData.nodes];

      if (connectionData.pageInfo.hasNextPage) {
        const remaining = await this.fetchRemainingConnectionPages(
          product.id,
          'Product',
          field,
          connectionData.pageInfo.endCursor,
        );
        allNodes = [...allNodes, ...remaining];
      }

      (product as unknown as Record<string, unknown>)[field] = allNodes;
    }
  }

  /**
   * Hydrate connections one at a time (fallback for cost-exceeded errors).
   */
  private async hydrateIndividually(product: ShopifyProduct): Promise<void> {
    for (const field of PRODUCT_OWNED_CONNECTIONS) {
      try {
        const nodes = await this.fetchFullConnection(product.id, 'Product', field);
        (product as unknown as Record<string, unknown>)[field] = nodes;
      } catch (error) {
        WSLogger.warn({
          source: LOG_SOURCE,
          message: `Failed to hydrate ${field} for product ${product.id}`,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // ============= Orders - Hydration =============

  /**
   * Hydrate owned connections (lineItems, shippingLines) for an order.
   */
  async hydrateOrderConnections(order: ShopifyOrder): Promise<ShopifyOrder> {
    const hydrated = { ...order };

    try {
      // Hydrate order connections individually (batched not needed - only 2 fields)
      for (const field of ORDER_OWNED_CONNECTIONS) {
        try {
          const nodes = await this.fetchFullConnection(order.id, 'Order', field);
          (hydrated as unknown as Record<string, unknown>)[field] = nodes;
        } catch (error) {
          WSLogger.warn({
            source: LOG_SOURCE,
            message: `Failed to hydrate ${field} for order ${order.id}`,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      WSLogger.warn({
        source: LOG_SOURCE,
        message: `Failed to hydrate connections for order ${order.id}`,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return hydrated;
  }

  // ============= Generic Connection Hydration =============

  /**
   * Fetch all nodes from a single connection field.
   */
  private async fetchFullConnection(
    entityId: string,
    entityTypeName: string,
    connectionField: string,
  ): Promise<Record<string, unknown>[]> {
    const allNodes: Record<string, unknown>[] = [];
    let cursor: string | null = null;
    let hasMore = true;

    while (hasMore) {
      const data = await this.query<{ node: Record<string, unknown> | null }>(
        this.buildSingleConnectionQuery(entityTypeName, connectionField),
        { id: entityId, first: HYDRATION_PAGE_SIZE, after: cursor },
      );

      if (!data.node) break;

      const connectionData = data.node[connectionField] as {
        nodes: Record<string, unknown>[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      } | null;

      if (!connectionData) break;

      allNodes.push(...connectionData.nodes);
      hasMore = connectionData.pageInfo.hasNextPage;
      cursor = connectionData.pageInfo.endCursor;
    }

    return allNodes;
  }

  /**
   * Fetch remaining pages after the initial batched hydration.
   */
  private async fetchRemainingConnectionPages(
    entityId: string,
    entityTypeName: string,
    connectionField: string,
    startCursor: string | null,
  ): Promise<Record<string, unknown>[]> {
    const allNodes: Record<string, unknown>[] = [];
    let cursor = startCursor;
    let hasMore = true;

    while (hasMore && cursor) {
      const data = await this.query<{ node: Record<string, unknown> | null }>(
        this.buildSingleConnectionQuery(entityTypeName, connectionField),
        { id: entityId, first: HYDRATION_PAGE_SIZE, after: cursor },
      );

      if (!data.node) break;

      const connectionData = data.node[connectionField] as {
        nodes: Record<string, unknown>[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      } | null;

      if (!connectionData) break;

      allNodes.push(...connectionData.nodes);
      hasMore = connectionData.pageInfo.hasNextPage;
      cursor = connectionData.pageInfo.endCursor;
    }

    return allNodes;
  }

  /**
   * Build a query for fetching a single connection field.
   */
  private buildSingleConnectionQuery(entityTypeName: string, connectionField: string): string {
    const productFragments: Record<string, string> = {
      variants: `
        variants(first: $first, after: $after) {
          nodes {
            id title sku price compareAtPrice inventoryQuantity
            barcode position taxable createdAt updatedAt
            selectedOptions { name value }
          }
          pageInfo { hasNextPage endCursor }
        }
      `,
      images: `
        images(first: $first, after: $after) {
          nodes { id url altText width height }
          pageInfo { hasNextPage endCursor }
        }
      `,
      media: `
        media(first: $first, after: $after) {
          nodes {
            ... on MediaImage { id alt mediaContentType status image { url altText width height } }
            ... on Video { id alt mediaContentType status }
            ... on ExternalVideo { id alt mediaContentType status embeddedUrl }
            ... on Model3d { id alt mediaContentType status }
          }
          pageInfo { hasNextPage endCursor }
        }
      `,
    };

    const fragmentMap: Record<string, Record<string, string>> = {
      Product: productFragments,
      Order: ORDER_CONNECTION_FRAGMENTS,
    };

    const fragments = fragmentMap[entityTypeName] ?? {};
    const fragment = fragments[connectionField];

    if (!fragment) {
      throw new ShopifyError(`Unknown connection field: ${entityTypeName}.${connectionField}`, 400);
    }

    return `
      query HydrateConnection($id: ID!, $first: Int!, $after: String) {
        node(id: $id) {
          ... on ${entityTypeName} {
            ${fragment}
          }
        }
      }
    `;
  }

  // ============= Products - Mutations =============

  /**
   * Create a product.
   */
  async createProduct(input: ShopifyProductInput): Promise<ShopifyProduct> {
    const mutationInput = transformCategoryInput(input);
    const data = await this.query<{
      productCreate: { product: ShopifyProduct | null; userErrors: ShopifyUserError[] };
    }>(
      `
      mutation ProductCreate($input: ProductInput!) {
        productCreate(input: $input) {
          product { ${PRODUCT_FIELDS} }
          userErrors { field message }
        }
      }
    `,
      { input: mutationInput },
    );

    this.throwOnUserErrors(data.productCreate.userErrors);

    if (!data.productCreate.product) {
      throw new ShopifyError('Failed to create product', 500);
    }

    return data.productCreate.product;
  }

  /**
   * Update a product.
   */
  async updateProduct(id: string, input: ShopifyProductInput): Promise<ShopifyProduct> {
    const mutationInput = transformCategoryInput(input);
    const data = await this.query<{
      productUpdate: { product: ShopifyProduct | null; userErrors: ShopifyUserError[] };
    }>(
      `
      mutation ProductUpdate($input: ProductInput!) {
        productUpdate(input: $input) {
          product { ${PRODUCT_FIELDS} }
          userErrors { field message }
        }
      }
    `,
      { input: { ...mutationInput, id } },
    );

    this.throwOnUserErrors(data.productUpdate.userErrors);

    if (!data.productUpdate.product) {
      throw new ShopifyError('Failed to update product', 500);
    }

    return data.productUpdate.product;
  }

  /**
   * Delete a product.
   */
  async deleteProduct(id: string): Promise<void> {
    const data = await this.query<{
      productDelete: { deletedProductId: string | null; userErrors: ShopifyUserError[] };
    }>(
      `
      mutation ProductDelete($input: ProductDeleteInput!) {
        productDelete(input: $input) {
          deletedProductId
          userErrors { field message }
        }
      }
    `,
      { input: { id } },
    );

    this.throwOnUserErrors(data.productDelete.userErrors);
  }

  // ============= Collections - Mutations =============

  async createCollection(input: ShopifyCollectionInput): Promise<ShopifyCollection> {
    const data = await this.query<{
      collectionCreate: { collection: ShopifyCollection | null; userErrors: ShopifyUserError[] };
    }>(
      `
      mutation CollectionCreate($input: CollectionInput!) {
        collectionCreate(input: $input) {
          collection { ${COLLECTION_FIELDS} }
          userErrors { field message }
        }
      }
    `,
      { input },
    );

    this.throwOnUserErrors(data.collectionCreate.userErrors);

    if (!data.collectionCreate.collection) {
      throw new ShopifyError('Failed to create collection', 500);
    }

    return data.collectionCreate.collection;
  }

  async updateCollection(id: string, input: ShopifyCollectionInput): Promise<ShopifyCollection> {
    const data = await this.query<{
      collectionUpdate: { collection: ShopifyCollection | null; userErrors: ShopifyUserError[] };
    }>(
      `
      mutation CollectionUpdate($input: CollectionInput!) {
        collectionUpdate(input: $input) {
          collection { ${COLLECTION_FIELDS} }
          userErrors { field message }
        }
      }
    `,
      { input: { ...input, id } },
    );

    this.throwOnUserErrors(data.collectionUpdate.userErrors);

    if (!data.collectionUpdate.collection) {
      throw new ShopifyError('Failed to update collection', 500);
    }

    return data.collectionUpdate.collection;
  }

  async deleteCollection(id: string): Promise<void> {
    const data = await this.query<{
      collectionDelete: { deletedCollectionId: string | null; userErrors: ShopifyUserError[] };
    }>(
      `
      mutation CollectionDelete($input: CollectionDeleteInput!) {
        collectionDelete(input: $input) {
          deletedCollectionId
          userErrors { field message }
        }
      }
    `,
      { input: { id } },
    );

    this.throwOnUserErrors(data.collectionDelete.userErrors);
  }

  // ============= Pages - Mutations =============

  async createPage(input: ShopifyPageInput): Promise<ShopifyPage> {
    const data = await this.query<{
      pageCreate: { page: ShopifyPage | null; userErrors: ShopifyUserError[] };
    }>(
      `
      mutation PageCreate($page: PageCreateInput!) {
        pageCreate(page: $page) {
          page { ${PAGE_FIELDS} }
          userErrors { field message }
        }
      }
    `,
      { page: input },
    );

    this.throwOnUserErrors(data.pageCreate.userErrors);

    if (!data.pageCreate.page) {
      throw new ShopifyError('Failed to create page', 500);
    }

    return data.pageCreate.page;
  }

  async updatePage(id: string, input: ShopifyPageInput): Promise<ShopifyPage> {
    const data = await this.query<{
      pageUpdate: { page: ShopifyPage | null; userErrors: ShopifyUserError[] };
    }>(
      `
      mutation PageUpdate($id: ID!, $page: PageUpdateInput!) {
        pageUpdate(id: $id, page: $page) {
          page { ${PAGE_FIELDS} }
          userErrors { field message }
        }
      }
    `,
      { id, page: input },
    );

    this.throwOnUserErrors(data.pageUpdate.userErrors);

    if (!data.pageUpdate.page) {
      throw new ShopifyError('Failed to update page', 500);
    }

    return data.pageUpdate.page;
  }

  async deletePage(id: string): Promise<void> {
    const data = await this.query<{
      pageDelete: { deletedPageId: string | null; userErrors: ShopifyUserError[] };
    }>(
      `
      mutation PageDelete($id: ID!) {
        pageDelete(id: $id) {
          deletedPageId
          userErrors { field message }
        }
      }
    `,
      { id },
    );

    this.throwOnUserErrors(data.pageDelete.userErrors);
  }

  // ============= Blogs - Mutations =============

  async createBlog(input: ShopifyBlogInput): Promise<ShopifyBlog> {
    const data = await this.query<{
      blogCreate: { blog: ShopifyBlog | null; userErrors: ShopifyUserError[] };
    }>(
      `
      mutation BlogCreate($blog: BlogCreateInput!) {
        blogCreate(blog: $blog) {
          blog { ${BLOG_FIELDS} }
          userErrors { field message }
        }
      }
    `,
      { blog: input },
    );

    this.throwOnUserErrors(data.blogCreate.userErrors);

    if (!data.blogCreate.blog) {
      throw new ShopifyError('Failed to create blog', 500);
    }

    return data.blogCreate.blog;
  }

  async updateBlog(id: string, input: ShopifyBlogInput): Promise<ShopifyBlog> {
    const data = await this.query<{
      blogUpdate: { blog: ShopifyBlog | null; userErrors: ShopifyUserError[] };
    }>(
      `
      mutation BlogUpdate($id: ID!, $blog: BlogUpdateInput!) {
        blogUpdate(id: $id, blog: $blog) {
          blog { ${BLOG_FIELDS} }
          userErrors { field message }
        }
      }
    `,
      { id, blog: input },
    );

    this.throwOnUserErrors(data.blogUpdate.userErrors);

    if (!data.blogUpdate.blog) {
      throw new ShopifyError('Failed to update blog', 500);
    }

    return data.blogUpdate.blog;
  }

  async deleteBlog(id: string): Promise<void> {
    const data = await this.query<{
      blogDelete: { deletedBlogId: string | null; userErrors: ShopifyUserError[] };
    }>(
      `
      mutation BlogDelete($id: ID!) {
        blogDelete(id: $id) {
          deletedBlogId
          userErrors { field message }
        }
      }
    `,
      { id },
    );

    this.throwOnUserErrors(data.blogDelete.userErrors);
  }

  // ============= Articles - Mutations =============

  async createArticle(input: ShopifyArticleInput): Promise<ShopifyArticle> {
    // Articles require blog.id in the mutation input as flat blogId
    if (!input.blog?.id) {
      throw new ShopifyError('blog.id is required to create an article', 400, 'MISSING_BLOG_ID');
    }

    // Transform blog.id → blogId and strip the nested blog object
    // Author is required by Shopify - use input author or default to 'Admin'
    const authorName = input.author?.name?.trim() || 'Admin';
    const articleInput: Record<string, unknown> = {
      title: input.title,
      body: input.body,
      summary: input.summary,
      handle: input.handle,
      tags: input.tags,
      isPublished: input.isPublished,
      templateSuffix: input.templateSuffix,
      blogId: input.blog.id,
      author: { name: authorName },
    };
    // Remove undefined values
    for (const key of Object.keys(articleInput)) {
      if (articleInput[key] === undefined) {
        delete articleInput[key];
      }
    }

    const data = await this.query<{
      articleCreate: { article: ShopifyArticle | null; userErrors: ShopifyUserError[] };
    }>(
      `
      mutation ArticleCreate($article: ArticleCreateInput!) {
        articleCreate(article: $article) {
          article { ${ARTICLE_FIELDS} }
          userErrors { field message }
        }
      }
    `,
      { article: articleInput },
    );

    this.throwOnUserErrors(data.articleCreate.userErrors);

    if (!data.articleCreate.article) {
      throw new ShopifyError('Failed to create article', 500);
    }

    return data.articleCreate.article;
  }

  async updateArticle(id: string, input: ShopifyArticleInput): Promise<ShopifyArticle> {
    const data = await this.query<{
      articleUpdate: { article: ShopifyArticle | null; userErrors: ShopifyUserError[] };
    }>(
      `
      mutation ArticleUpdate($id: ID!, $article: ArticleUpdateInput!) {
        articleUpdate(id: $id, article: $article) {
          article { ${ARTICLE_FIELDS} }
          userErrors { field message }
        }
      }
    `,
      { id, article: input },
    );

    this.throwOnUserErrors(data.articleUpdate.userErrors);

    if (!data.articleUpdate.article) {
      throw new ShopifyError('Failed to update article', 500);
    }

    return data.articleUpdate.article;
  }

  async deleteArticle(id: string): Promise<void> {
    const data = await this.query<{
      articleDelete: { deletedArticleId: string | null; userErrors: ShopifyUserError[] };
    }>(
      `
      mutation ArticleDelete($id: ID!) {
        articleDelete(id: $id) {
          deletedArticleId
          userErrors { field message }
        }
      }
    `,
      { id },
    );

    this.throwOnUserErrors(data.articleDelete.userErrors);
  }

  // ============= Dispatch CRUD Methods =============

  /**
   * Create an entity of the given writable type.
   */
  createEntity(
    entityType: ShopifyWritableEntityType,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    switch (entityType) {
      case 'products':
        return this.createProduct(input as ShopifyProductInput) as unknown as Promise<Record<string, unknown>>;
      case 'collections':
        return this.createCollection(input as ShopifyCollectionInput) as unknown as Promise<Record<string, unknown>>;
      case 'pages':
        return this.createPage(input as ShopifyPageInput) as unknown as Promise<Record<string, unknown>>;
      case 'blogs':
        return this.createBlog(input as ShopifyBlogInput) as unknown as Promise<Record<string, unknown>>;
      case 'articles':
        return this.createArticle(input as ShopifyArticleInput) as unknown as Promise<Record<string, unknown>>;
    }
  }

  /**
   * Update an entity of the given writable type.
   */
  async updateEntity(entityType: ShopifyWritableEntityType, id: string, input: Record<string, unknown>): Promise<void> {
    switch (entityType) {
      case 'products':
        await this.updateProduct(id, input as ShopifyProductInput);
        break;
      case 'collections':
        await this.updateCollection(id, input as ShopifyCollectionInput);
        break;
      case 'pages':
        await this.updatePage(id, input as ShopifyPageInput);
        break;
      case 'blogs':
        await this.updateBlog(id, input as ShopifyBlogInput);
        break;
      case 'articles':
        await this.updateArticle(id, input as ShopifyArticleInput);
        break;
    }
  }

  /**
   * Delete an entity of the given writable type.
   */
  async deleteEntity(entityType: ShopifyWritableEntityType, id: string): Promise<void> {
    switch (entityType) {
      case 'products':
        await this.deleteProduct(id);
        break;
      case 'collections':
        await this.deleteCollection(id);
        break;
      case 'pages':
        await this.deletePage(id);
        break;
      case 'blogs':
        await this.deleteBlog(id);
        break;
      case 'articles':
        await this.deleteArticle(id);
        break;
    }
  }

  // ============= Helpers =============

  /**
   * Throw a ShopifyError if there are user errors from a mutation.
   */
  private throwOnUserErrors(userErrors: ShopifyUserError[]): void {
    if (userErrors.length > 0) {
      throw new ShopifyError(userErrors.map((e) => e.message).join(', '), 400, 'USER_ERROR', userErrors);
    }
  }
}
