/**
 * Shopify TypeBox schema builders for each entity type.
 *
 * Each builder returns a TSchema used by fetchJsonTableSpec to describe
 * the shape of records for that entity.
 */

import { Type, type TSchema } from '@sinclair/typebox';
import { FOREIGN_KEY_OPTIONS } from '../../json-schema';

// ============= Products =============

export function buildProductSchema(): TSchema {
  const variantSchema = Type.Object({
    id: Type.Optional(Type.String()),
    title: Type.Optional(Type.String()),
    sku: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    price: Type.Optional(Type.String()),
    compareAtPrice: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    inventoryQuantity: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    weight: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    weightUnit: Type.Optional(Type.String()),
    barcode: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    position: Type.Optional(Type.Number()),
    taxable: Type.Optional(Type.Boolean()),
    createdAt: Type.Optional(Type.String({ format: 'date-time' })),
    updatedAt: Type.Optional(Type.String({ format: 'date-time' })),
    selectedOptions: Type.Optional(Type.Array(Type.Object({ name: Type.String(), value: Type.String() }))),
  });

  const imageSchema = Type.Object({
    id: Type.Optional(Type.String()),
    url: Type.Optional(Type.String()),
    altText: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    width: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    height: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  });

  const mediaSchema = Type.Object({
    id: Type.Optional(Type.String()),
    alt: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    mediaContentType: Type.Optional(Type.String()),
    status: Type.Optional(Type.String()),
  });

  return Type.Object(
    {
      id: Type.String({ description: 'Shopify global ID (read-only)' }),
      handle: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'URL handle' })),
      title: Type.String({ description: 'Product title' }),
      description: Type.Optional(
        Type.Union([Type.String(), Type.Null()], {
          description: 'Plain-text description (read-only, derived from descriptionHtml)',
        }),
      ),
      descriptionHtml: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'HTML description' })),
      vendor: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Product vendor' })),
      productType: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Product type' })),
      category: Type.Optional(
        Type.Union(
          [
            Type.Object({
              id: Type.String({ description: 'Taxonomy category GID' }),
              name: Type.String({ description: 'Taxonomy category name (read-only)' }),
              fullName: Type.String({ description: 'Full taxonomy path (read-only)' }),
            }),
            Type.Null(),
          ],
          { description: 'Standardized product taxonomy category' },
        ),
      ),
      status: Type.Optional(
        Type.Union([Type.Literal('ACTIVE'), Type.Literal('ARCHIVED'), Type.Literal('DRAFT')], {
          description: 'Product status',
        }),
      ),
      tags: Type.Optional(Type.Array(Type.String(), { description: 'Product tags' })),
      templateSuffix: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Theme template suffix' })),
      createdAt: Type.Optional(Type.String({ description: 'Created timestamp (read-only)', format: 'date-time' })),
      updatedAt: Type.Optional(Type.String({ description: 'Updated timestamp (read-only)', format: 'date-time' })),
      variants: Type.Optional(Type.Array(variantSchema, { description: 'Product variants (read-only)' })),
      images: Type.Optional(Type.Array(imageSchema, { description: 'Product images (read-only)' })),
      media: Type.Optional(Type.Array(mediaSchema, { description: 'Product media (read-only)' })),
    },
    { $id: 'shopify/products', title: 'Products' },
  );
}

// ============= Collections =============

export function buildCollectionSchema(): TSchema {
  return Type.Object(
    {
      id: Type.String({ description: 'Shopify global ID (read-only)' }),
      handle: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'URL handle' })),
      title: Type.String({ description: 'Collection title' }),
      description: Type.Optional(
        Type.Union([Type.String(), Type.Null()], { description: 'Plain-text description (read-only)' }),
      ),
      descriptionHtml: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'HTML description' })),
      sortOrder: Type.Optional(
        Type.Union([Type.String(), Type.Null()], { description: 'Sort order for products in the collection' }),
      ),
      templateSuffix: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Theme template suffix' })),
      updatedAt: Type.Optional(Type.String({ description: 'Updated timestamp (read-only)', format: 'date-time' })),
    },
    { $id: 'shopify/collections', title: 'Collections' },
  );
}

// ============= Pages =============

export function buildPageSchema(): TSchema {
  return Type.Object(
    {
      id: Type.String({ description: 'Shopify global ID (read-only)' }),
      handle: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'URL handle' })),
      title: Type.String({ description: 'Page title' }),
      body: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'HTML body content' })),
      bodySummary: Type.Optional(
        Type.Union([Type.String(), Type.Null()], { description: 'Plain-text summary (read-only)' }),
      ),
      isPublished: Type.Optional(Type.Boolean({ description: 'Whether the page is published' })),
      publishedAt: Type.Optional(
        Type.Union([Type.String({ format: 'date-time' }), Type.Null()], { description: 'Published timestamp' }),
      ),
      templateSuffix: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Theme template suffix' })),
      createdAt: Type.Optional(Type.String({ description: 'Created timestamp (read-only)', format: 'date-time' })),
      updatedAt: Type.Optional(Type.String({ description: 'Updated timestamp (read-only)', format: 'date-time' })),
    },
    { $id: 'shopify/pages', title: 'Pages' },
  );
}

// ============= Blogs =============

export function buildBlogSchema(): TSchema {
  return Type.Object(
    {
      id: Type.String({ description: 'Shopify global ID (read-only)' }),
      handle: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'URL handle' })),
      title: Type.String({ description: 'Blog title' }),
      templateSuffix: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Theme template suffix' })),
      createdAt: Type.Optional(Type.String({ description: 'Created timestamp (read-only)', format: 'date-time' })),
      updatedAt: Type.Optional(Type.String({ description: 'Updated timestamp (read-only)', format: 'date-time' })),
    },
    { $id: 'shopify/blogs', title: 'Blogs' },
  );
}

// ============= Articles =============

export function buildArticleSchema(): TSchema {
  return Type.Object(
    {
      id: Type.String({ description: 'Shopify global ID (read-only)' }),
      handle: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'URL handle' })),
      title: Type.String({ description: 'Article title' }),
      body: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'HTML body content' })),
      summary: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Article summary / excerpt' })),
      author: Type.Optional(Type.Object({ name: Type.String() }, { description: 'Author info (read-only)' })),
      tags: Type.Optional(Type.Array(Type.String(), { description: 'Article tags' })),
      isPublished: Type.Optional(Type.Boolean({ description: 'Whether the article is published' })),
      publishedAt: Type.Optional(
        Type.Union([Type.String({ format: 'date-time' }), Type.Null()], { description: 'Published timestamp' }),
      ),
      templateSuffix: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Theme template suffix' })),
      blog: Type.Object(
        { id: Type.String(), handle: Type.String() },
        {
          description: 'Parent blog (read-only except blog.id on create)',
          [FOREIGN_KEY_OPTIONS]: { linkedTableId: 'blogs' },
        },
      ),
      createdAt: Type.Optional(Type.String({ description: 'Created timestamp (read-only)', format: 'date-time' })),
      updatedAt: Type.Optional(Type.String({ description: 'Updated timestamp (read-only)', format: 'date-time' })),
    },
    { $id: 'shopify/articles', title: 'Articles' },
  );
}

// ============= Customers (read-only) =============

export function buildCustomerSchema(): TSchema {
  return Type.Object(
    {
      id: Type.String({ description: 'Shopify global ID (read-only)' }),
      firstName: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'First name' })),
      lastName: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Last name' })),
      displayName: Type.Optional(Type.String({ description: 'Display name' })),
      email: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Email address' })),
      phone: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Phone number' })),
      state: Type.Optional(Type.String({ description: 'Account state' })),
      note: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Merchant note' })),
      verifiedEmail: Type.Optional(Type.Boolean({ description: 'Whether email is verified' })),
      taxExempt: Type.Optional(Type.Boolean({ description: 'Whether customer is tax exempt' })),
      tags: Type.Optional(Type.Array(Type.String(), { description: 'Customer tags' })),
      amountSpent: Type.Optional(
        Type.Object({ amount: Type.String(), currencyCode: Type.String() }, { description: 'Total amount spent' }),
      ),
      numberOfOrders: Type.Optional(Type.String({ description: 'Number of orders placed' })),
      createdAt: Type.Optional(Type.String({ description: 'Created timestamp', format: 'date-time' })),
      updatedAt: Type.Optional(Type.String({ description: 'Updated timestamp', format: 'date-time' })),
    },
    { $id: 'shopify/customers', title: 'Customers' },
  );
}

// ============= Orders (read-only) =============

export function buildOrderSchema(): TSchema {
  const moneyBagSchema = Type.Object({
    shopMoney: Type.Object({ amount: Type.String(), currencyCode: Type.String() }),
  });

  const lineItemSchema = Type.Object({
    id: Type.Optional(Type.String()),
    title: Type.Optional(Type.String()),
    quantity: Type.Optional(Type.Number()),
    sku: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    variant: Type.Optional(Type.Union([Type.Object({ id: Type.String(), title: Type.String() }), Type.Null()])),
    originalTotalSet: Type.Optional(moneyBagSchema),
    discountedTotalSet: Type.Optional(moneyBagSchema),
  });

  const shippingLineSchema = Type.Object({
    id: Type.Optional(Type.String()),
    title: Type.Optional(Type.String()),
    code: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    originalPriceSet: Type.Optional(moneyBagSchema),
    discountedPriceSet: Type.Optional(moneyBagSchema),
  });

  return Type.Object(
    {
      id: Type.String({ description: 'Shopify global ID' }),
      name: Type.Optional(Type.String({ description: 'Order name (e.g. #1001)' })),
      email: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Customer email' })),
      phone: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Customer phone' })),
      customer: Type.Optional(
        Type.Union([Type.Object({ id: Type.String(), displayName: Type.String() }), Type.Null()], {
          description: 'Customer reference',
          [FOREIGN_KEY_OPTIONS]: { linkedTableId: 'customers' },
        }),
      ),
      totalPriceSet: Type.Optional(moneyBagSchema),
      subtotalPriceSet: Type.Optional(moneyBagSchema),
      totalShippingPriceSet: Type.Optional(moneyBagSchema),
      totalTaxSet: Type.Optional(moneyBagSchema),
      totalDiscountsSet: Type.Optional(moneyBagSchema),
      displayFinancialStatus: Type.Optional(
        Type.Union([Type.String(), Type.Null()], { description: 'Financial status' }),
      ),
      displayFulfillmentStatus: Type.Optional(Type.String({ description: 'Fulfillment status' })),
      tags: Type.Optional(Type.Array(Type.String(), { description: 'Order tags' })),
      note: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Order note' })),
      cancelledAt: Type.Optional(
        Type.Union([Type.String({ format: 'date-time' }), Type.Null()], { description: 'Cancellation timestamp' }),
      ),
      closedAt: Type.Optional(
        Type.Union([Type.String({ format: 'date-time' }), Type.Null()], { description: 'Closed timestamp' }),
      ),
      processedAt: Type.Optional(
        Type.Union([Type.String({ format: 'date-time' }), Type.Null()], { description: 'Processed timestamp' }),
      ),
      createdAt: Type.Optional(Type.String({ description: 'Created timestamp', format: 'date-time' })),
      updatedAt: Type.Optional(Type.String({ description: 'Updated timestamp', format: 'date-time' })),
      lineItems: Type.Optional(Type.Array(lineItemSchema, { description: 'Order line items' })),
      shippingLines: Type.Optional(Type.Array(shippingLineSchema, { description: 'Shipping lines' })),
    },
    { $id: 'shopify/orders', title: 'Orders' },
  );
}

// ============= Files (read-only) =============

export function buildFileSchema(): TSchema {
  return Type.Object(
    {
      id: Type.String({ description: 'Shopify global ID' }),
      alt: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Alt text' })),
      fileStatus: Type.Optional(Type.String({ description: 'Processing status' })),
      mimeType: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'MIME type' })),
      originalFileSize: Type.Optional(
        Type.Union([Type.Number(), Type.Null()], { description: 'Original file size in bytes' }),
      ),
      url: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'File URL' })),
      createdAt: Type.Optional(Type.String({ description: 'Created timestamp', format: 'date-time' })),
      updatedAt: Type.Optional(Type.String({ description: 'Updated timestamp', format: 'date-time' })),
    },
    { $id: 'shopify/files', title: 'Files' },
  );
}

// ============= Metaobjects (read-only) =============

export function buildMetaobjectSchema(): TSchema {
  return Type.Object(
    {
      id: Type.String({ description: 'Shopify global ID' }),
      handle: Type.Optional(Type.String({ description: 'Metaobject handle' })),
      type: Type.Optional(Type.String({ description: 'Metaobject type' })),
      displayName: Type.Optional(Type.String({ description: 'Display name' })),
      fields: Type.Optional(
        Type.Array(
          Type.Object({
            key: Type.String(),
            value: Type.Union([Type.String(), Type.Null()]),
            type: Type.String(),
          }),
          { description: 'Metaobject fields' },
        ),
      ),
      updatedAt: Type.Optional(Type.String({ description: 'Updated timestamp', format: 'date-time' })),
    },
    { $id: 'shopify/metaobjects', title: 'Metaobjects' },
  );
}
