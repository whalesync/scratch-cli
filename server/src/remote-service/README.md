# Remote Service Module

## Overview

The remote-service module is the core abstraction layer responsible for managing connections to external data sources and coordinating data synchronization operations.

## Purpose

This module provides a unified interface for integrating with multiple third-party services (Airtable, WordPress, Notion, YouTube, Webflow, Wix Blog, CSV, and Custom connectors) while handling credential management, authentication, and data transformation.

## Architecture

### Two Primary Sub-modules

#### ConnectorAccountService

- Credential management and orchestration
- Secure storage of authentication data
- Connection testing and validation
- Account lifecycle management

#### ConnectorsService

- Implementation details for individual data sources
- Service-specific API interactions
- Data transformation logic
- Common interface abstraction

## Endpoints

All endpoints protected by `ScratchpadAuthGuard`:

### `POST /connector-accounts`

Create a new connector account.

### `GET /connector-accounts`

List all connector accounts for authenticated user.

### `GET /connector-accounts/:id`

Retrieve specific connector account details.

### `PUT /connector-accounts/:id`

Update connector account configuration.

### `DELETE /connector-accounts/:id`

Remove a connector account.

### `POST /connector-accounts/test`

Test connection validity with provided credentials.

### `GET /connector-accounts/:id/tables`

List available tables from a connected data source.

## Supported Connectors

- **Airtable**: Workspace and base integration
- **WordPress**: Blog and content management
- **Notion**: Database and workspace integration
- **YouTube**: Video platform integration
- **Webflow**: CMS and website integration
- **Wix Blog**: Blog platform integration
- **CSV**: File-based data import
- **Custom**: User-defined connectors via AI generation

## Connector Pattern

### Abstract Connector Base Class

Defines common interface for all connectors:

- **listTables()**: Get available tables/entities
- **fetchJsonTableSpec()**: Retrieve table schema as JSON Schema
- **downloadRecords()**: Fetch data from source
- **pushCreate()**: Create records in remote service
- **pushUpdate()**: Update existing records
- **pushDelete()**: Delete records from remote service

### Service-Specific Implementations

Each connector handles:

- Authentication mechanisms
- API quirks and rate limits
- Data format transformations
- Error handling

## Security

### Credential Encryption

- Access tokens encrypted before storage
- Decryption on-demand when needed
- Secure key management

### Token Management

- Automatic token refresh for OAuth
- Expiration checking
- Secure credential storage

## Integration

The module integrates with:

- **Audit System**: Logs connector operations
- **PostHog**: Analytics tracking
- **OAuth Service**: OAuth-based authentication
- **Database Layer**: Persists connector accounts via Prisma

## ConnectorAccountService

### Responsibilities

- Parse user-provided authentication parameters
- Validate connections
- Encrypt/decrypt credentials
- Manage connector lifecycle
- Delegate data operations to appropriate connector

## ConnectorsService

### Factory Pattern

Instantiates the correct connector implementation based on service type:

- Routes requests to appropriate connector
- Manages connector instances
- Handles connector initialization errors

## Data Operations

### Read Operations

- List available tables
- Fetch table schemas
- Download records with pagination
- Query filtered data

### Write Operations

- Create new records
- Update existing records
- Delete records
- Bulk operations support

## Error Handling

Comprehensive error handling for:

- Invalid credentials
- Network failures
- Rate limiting
- API errors
- Malformed data

## Use Cases

- Sync data between services
- Import data from external sources
- Export data to third-party platforms
- Bi-directional synchronization
- Custom integration workflows
- API testing and validation

## Benefits

- **Unified Interface**: Single API for multiple services
- **Extensible**: Easy to add new connectors
- **Secure**: Encrypted credential storage
- **Reliable**: Comprehensive error handling
- **Flexible**: Supports various authentication methods
