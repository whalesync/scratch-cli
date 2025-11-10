# DB Module

## Overview

The db module serves as the database abstraction layer for the Whalesync Spinner application, providing centralized database connectivity and ORM management.

## Purpose

This module manages database clients and provides a unified interface for data access across the application. It handles connection establishment, configuration, and graceful shutdown.

## Key Components

### DbService

The core service manages two primary database clients:

1. **Prisma Client**: Modern ORM for type-safe database operations
   - Primary interface for most database queries
   - Generated types from Prisma schema
   - Transaction support
   - Migration management

2. **Knex Client**: Query builder for complex SQL operations
   - Used for advanced queries not easily expressed in Prisma
   - Supports raw SQL when needed
   - CloudSQL SSL configuration

## Initialization

The service is initialized with:
- Database connection URL from configuration
- SSL certificate handling for CloudSQL environments
- Connection string parsing
- Proper lifecycle management

## Type Safety

The `cluster-types.ts` file defines:
- TypeScript types for domain entities
- Prisma validators for key models:
  - User
  - Snapshot
  - SnapshotTable
  - StyleGuide
- Type-safe operations for querying with relationships

## Lifecycle Management

The DbService implements NestJS lifecycle hooks:
- **onModuleInit**: Establishes database connections
- **onModuleDestroy**: Gracefully closes connections

## Integration

The DbModule is:
- Imported at application root level
- Acts as a foundational module
- Used by virtually all services requiring data persistence:
  - `snapshot-db.service.ts`
  - `uploads-db.service.ts`
  - `users.service.ts`
  - And many more

## Usage Pattern

Services inject DbService to access the Prisma client:

```typescript
constructor(private readonly dbService: DbService) {}

async getData() {
  return this.dbService.client.user.findMany();
}
```

## Database Operations

The module supports:
- CRUD operations
- Complex queries with relations
- Transactions
- Raw SQL queries (via Knex)
- Connection pooling
- SSL/TLS for secure connections

## Environment Support

Handles different database configurations for:
- Local development
- Testing
- Staging
- Production (with CloudSQL)
