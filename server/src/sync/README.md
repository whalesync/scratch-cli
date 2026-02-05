# Sync Module

This module enables syncing records between source and destination DataFolders within a workbook.

## Overview

The sync system copies data from a **source** DataFolder to a **destination** DataFolder, transforming fields according to column mappings. It supports:

- **Record matching**: Identifying which source records correspond to existing destination records
- **Field mapping**: Transforming source fields to destination schema
- **Schema validation**: Ensuring mapped fields have compatible types

## Data Model

### SyncMapping (`@spinner/shared-types`)

The core configuration for a sync, stored as JSON in the `Sync.mappings` column. See type definitions in [packages/shared-types/src/sync-mapping.ts](../../../packages/shared-types/src/sync-mapping.ts):

- `SyncMapping`: Top-level sync configuration with version and table mappings
- `TableMapping`: Maps a source DataFolder to a destination DataFolder with column mappings and optional record matching
- `LocalColumnMapping`: Direct field-to-field mapping
- `ForeignKeyLookupColumnMapping`: Resolve FK to a value from the referenced table (not yet implemented)

### Database Tables

| Table | Purpose |
|-------|---------|
| `Sync` | Stores sync configuration including name and mappings JSON |
| `SyncTablePair` | Links source/destination DataFolder pairs for a sync |
| `SyncMatchKeys` | Temporary table for matching records during sync execution |
| `SyncRemoteIdMapping` | Persists source→destination record ID mappings |

## Sync Execution Flow

When `POST /workbooks/:workbookId/syncs/:syncId/run` is called:

1. **Job Queued**: A background job is enqueued via BullMQ
2. **Clear Match Keys**: Previous match keys for this sync are deleted
3. **Fetch Records**: Files are read from both source and destination DataFolders
4. **Parse Records**: JSON files are parsed into `ConnectorRecord` objects
5. **Build Match Keys**: Insert match column values into `SyncMatchKeys` for both sides
6. **Find Matches**: SQL join identifies records existing in both source and destination
7. **Transform Records**: Apply column mappings to convert source fields to destination schema
8. **Write Files**:
   - **New records**: Written to destination with temporary filename (`pending-publish-*.json`)
   - **Existing records**: Overwrite the matched destination file
9. **Commit**: All file changes are committed to the `DIRTY_BRANCH` via git
10. **Update Mappings**: Store source→destination ID mappings in `SyncRemoteIdMapping`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/workbooks/:workbookId/syncs` | Create a new sync |
| `PATCH` | `/workbooks/:workbookId/syncs/:syncId` | Update sync configuration |
| `GET` | `/workbooks/:workbookId/syncs` | List all syncs for a workbook |
| `POST` | `/workbooks/:workbookId/syncs/:syncId/run` | Execute the sync |
| `DELETE` | `/workbooks/:workbookId/syncs/:syncId` | Delete a sync |
| `POST` | `/workbooks/:workbookId/syncs/validate-mapping` | Validate field mapping between two schemas |

### Create/Update Sync DTO

See [dtos/create-sync.dto.ts](dtos/create-sync.dto.ts) for the full DTO definition. Key fields:

- `name`: Display name for the sync
- `folderMappings`: Array of source→destination folder mappings with field maps
- `schedule`, `autoPublish`: Accepted but not yet implemented

## Schema Validation

The `validateSchemaMapping()` function ensures mapped fields have compatible types:

- Traverses TypeBox JSON schemas using dot-notation paths
- Unwraps `Optional<T>` (union with null) to get base type
- Compares base types (string, number, boolean, object)
- Returns validation errors if types don't match

## Record Matching

Records are matched between source and destination using the `recordMatching` configuration:

1. Source records: Match key = value of `sourceColumnId` field
2. Destination records: Match key = value of `destinationColumnId` field
3. Records with the same match key are considered the same record

Common pattern: Source uses `id` column, destination stores the source ID in a dedicated column.

### Auto-injection of Match Key

When creating **new** destination records, the sync automatically injects the source's match key value into the destination's match key field. This ensures subsequent syncs can match the record by content.

Example: If `recordMatching` is configured as:
```typescript
recordMatching: {
  sourceColumnId: 'id',
  destinationColumnId: 'source_id'
}
```

And a source record has `{ id: 'rec_001', name: 'John' }`, the new destination record will automatically include `source_id: 'rec_001'` even if it's not in the column mappings.

**Behavior notes:**
- If column mappings already populate the match key field, auto-injection is skipped (user config wins)
- If the source record is missing the match key field, the record fails with an error

## Key Files

| File | Description |
|------|-------------|
| [sync.service.ts](sync.service.ts) | Core sync logic |
| [sync.controller.ts](sync.controller.ts) | REST API endpoints |
| [schema-validator.ts](schema-validator.ts) | Schema compatibility checking |
| [dtos/create-sync.dto.ts](dtos/create-sync.dto.ts) | Request validation |

## Limitations

- `ForeignKeyLookupColumnMapping` throws "not yet implemented"
- `schedule` and `autoPublish` are accepted in DTOs but not used
- Files are serialized as plain JSON (not markdown with frontmatter)
