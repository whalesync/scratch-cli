# Uploads Module

## Overview

The uploads module is a file ingestion and storage service that handles CSV and Markdown file uploads for the Whalesync application.

## Purpose

This module manages the complete lifecycle of uploaded files—from preview and validation through storage and deletion—while organizing data in PostgreSQL schemas partitioned by organization.

## Supported File Types

### CSV Files
- Parsed and streamed into PostgreSQL tables
- Inferred column typing
- Efficient stream processing
- Preview before import

### Markdown Files
- With front matter support
- Stored as structured JSON records
- Page content preserved
- Metadata extraction

## Controllers

### UploadsController
**Authentication**: Required (`ScratchpadAuthGuard`)

Provides endpoints for:
- Uploading files
- Previewing data
- Listing uploads
- Querying records
- Deleting uploads
- Creating snapshots from CSV uploads

### UploadsPublicController
**Authentication**: Not required (security via unguessable upload IDs)

Provides:
- Public download endpoints
- Shareable CSV exports
- No auth required (URL-based access)

## Core Services

### UploadsService

Handles business logic:
- **CSV Streaming**: Efficient data processing with transform pipelines
- **PostgreSQL COPY**: Minimizes memory overhead for large files
- **Schema Introspection**: Discovers table structure
- **Column Type Mapping**: Infers appropriate types
- **Data Preview**: Shows sample data before commit

### UploadsDbService

Manages database operations:
- **Organization-scoped Schemas**: `uploads_{organizationId}` prefix
- **Dynamic Table Creation**: CSV tables with proper column typing
- **Shared MdUploads Table**: Markdown storage
- **Schema Management**: Create and maintain upload schemas

## CSV Processing

### Stream Pipeline
1. Parse CSV file
2. Infer column types
3. Transform data
4. Stream to PostgreSQL using COPY command
5. Minimal memory usage

### Column Type Inference
- Automatic type detection
- Number vs. string
- Date formats
- Boolean values

### Preview Mode
- View sample data
- Validate structure
- Check before committing

## Markdown Processing

### Front Matter
- YAML metadata extraction
- Structured storage
- Page content separation

### Storage Format
- JSON records in shared table
- Organization-scoped
- Searchable metadata

## Schema Organization

### Per-Organization Schemas
- `uploads_{organizationId}` naming
- Isolated data per organization
- Multi-tenant security

### Table Structure
- CSV: One table per upload
- Markdown: Shared MdUploads table
- Proper indexing

## Integration with Snapshots

### CSV to Snapshot
- Materialize CSV uploads into snapshot tables
- Bridge between ephemeral and persistent data
- Create immutable copies
- Enable synchronization workflows

## Endpoints

### Upload Operations
- `POST /uploads`: Upload new file
- `GET /uploads/preview`: Preview upload data
- `GET /uploads`: List user's uploads
- `GET /uploads/:id`: Get specific upload
- `DELETE /uploads/:id`: Delete upload

### Query Operations
- `GET /uploads/:id/query`: Query upload data
- Supports filtering and pagination
- SQL-like operations

### Snapshot Creation
- `POST /uploads/:id/snapshot`: Create snapshot from CSV

### Public Access
- `GET /public/uploads/:id/download`: Public CSV download

## Security

### Authenticated Access
- User must own upload
- Organization-scoped queries
- Access control per upload

### Public Access
- Unguessable upload IDs
- URL-based security
- No auth required for sharing

## Performance

### Streaming
- Low memory footprint
- Handle large files efficiently
- PostgreSQL COPY for speed

### Indexing
- Proper database indexes
- Fast queries
- Efficient lookups

## Use Cases

- Import data from CSV files
- Store markdown documentation
- Preview data before commit
- Create snapshots from uploads
- Share data via public URLs
- Temporary data staging
- Data validation workflows

## Error Handling

Handles:
- Invalid CSV format
- Unsupported file types
- Large file limits
- Schema creation errors
- Database errors

## Benefits

- **Efficient**: Stream processing for large files
- **Secure**: Organization-level isolation
- **Flexible**: Multiple file types supported
- **Integrated**: Works with snapshot system
- **Scalable**: PostgreSQL-backed storage
- **Shareable**: Public download URLs
