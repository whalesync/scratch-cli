# Snapshot Module

## Overview

The snapshot module is a comprehensive data management system that serves as a local, in-memory workspace for viewing, editing, and publishing data from external services. It acts as an intermediary between external data sources and the application.

## Purpose

This module manages snapshots—isolated PostgreSQL schemas that store copies of remote table data. Users can create workspaces containing tables from various connectors, manipulate data with AI-assisted suggestions, and publish changes back to source systems.

## Core Functionality

### Snapshot Management

- Create snapshots with tables from different connectors
- Query and edit records locally
- Bulk-update records
- Accept/reject AI-generated suggestions
- Publish changes back to source systems

### Data Operations

- Create new records
- Update existing records
- Delete records
- Filter with SQL WHERE clauses
- Set page sizes for pagination
- Add scratch columns for temporary data

## Controllers

### SnapshotController

Primary authenticated API for snapshot operations:

- CRUD operations on snapshots
- Table management
- Record operations
- Publishing workflow

### AiSnapshotController

AI-specific record access for agent operations.

### SnapshotPublicController

Unauthenticated CSV export for shareable data.

## Real-time Features

### Server-Sent Events (SSE)

Real-time updates on:

- Snapshot changes
- Record modifications
- Synchronization status

### WebSocket Support

Via `SnapshotDataGateway`:

- Live subscription-based notifications
- Real-time collaboration
- Change propagation

### Event Infrastructure

- Redis Pub/Sub for event distribution
- Multi-instance support
- Horizontal scaling capability

## Asynchronous Processing

### Background Jobs

Uses Bull queues for:

- Large data downloads
- Publishing operations
- Long-running synchronization tasks

## Integration Points

### External Services

- **Connectors**: Fetch table schemas and records
- **Connector Accounts**: Authentication management
- **Database Service**: Snapshot schema creation and querying

### Internal Services

- **Audit Logging**: Track all changes
- **PostHog**: Analytics tracking
- **Worker Enqueuer**: Background job processing

## Data Model

### Snapshot

- Contains multiple tables
- Isolated PostgreSQL schema
- User/organization ownership
- Configuration metadata

### Records

- Stored in snapshot-specific schema
- Flexible JSON columns
- AI-generated suggestions
- Change tracking

## Configuration Storage

Maintains metadata on individual snapshot tables:

- Column visibility and ordering
- Filters and sorting
- Title column selection
- Page size preferences

## Publishing Workflow

1. User makes changes locally in snapshot
2. AI can suggest modifications
3. User accepts or rejects suggestions
4. User initiates publish
5. Changes sync back to source system
6. Audit trail captured

## CSV Operations

### Import

- Upload CSV files
- Preview before import
- Map columns to schema
- Import as suggestions

### Export

- Export snapshot data
- Public shareable URLs
- Filtered exports
- CSV format generation

## Multi-Service Support

Single snapshot can contain tables from:

- Multiple connector types
- Different accounts
- Various external services
- Mixed data sources

## Use Cases

- Data staging and preview
- Bulk data editing
- AI-assisted data transformation
- Multi-source data aggregation
- Collaborative data management
- Safe data manipulation before publishing
- Cross-service data synchronization

## Benefits

- **Safety**: Local changes before publishing
- **Flexibility**: Mix data from multiple sources
- **Collaboration**: Real-time updates
- **AI Integration**: Suggested improvements
- **Audit Trail**: Complete change history
- **Performance**: Local queries, background sync
