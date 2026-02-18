# GraphQL Codegen Framework

A tool for generating TypeBox schemas and mutation code from GraphQL APIs via introspection.

## Quick Start (Shopify)

```bash
# Set environment variables
export SHOPIFY_CODEGEN_SHOP=your-store-name
export SHOPIFY_CODEGEN_TOKEN=shpat_xxxxx

# Run codegen
yarn codegen:shopify
```

This generates TypeBox schemas, mutations, and query fields to:
`server/src/remote-service/connectors/library/shopify/graphql/`

See [`src/shopify/run.ts`](./src/shopify/run.ts) for the full implementation.

### Plus-Only Entities

Some entities (customers, orders, order_line_items, order_shipping_lines) require Shopify Plus
and are marked with `metadata: { plusOnly: true }` in the generated config. The connector
automatically excludes these from `listTables()` so they don't appear for non-Plus stores.

## Overview

This framework introspects a GraphQL API and generates:

- **TypeBox schemas** - Type-safe runtime validation schemas
- **Query field selections** - GraphQL field selection strings for fetching entities
- **Mutation code** - Create/update/delete mutation strings with input type handling
- **Metadata** - API version and generation timestamps

In theory, this tool is service-agnostic and can be adapted for any GraphQL API by providing service-specific configuration.

## Architecture

```
codegen/graphql/
├── README.md             # This file
├── types.ts              # Configuration interfaces and introspection types
├── introspector.ts       # GraphQL schema introspection via queries
├── typebox-generator.ts  # Converts introspected schemas to TypeBox code
├── mutation-generator.ts # Generates mutation strings from introspected mutations
├── index.ts              # Re-exports
└── shopify/              # Shopify implementation (reference example)
    ├── config.ts         # Entity configs, field filters, Plus-only handling
    └── run.ts            # Codegen entry point (yarn codegen:shopify)
```

## Adding a New Service

To add codegen for a new GraphQL service, use `shopify/` as a reference implementation.
