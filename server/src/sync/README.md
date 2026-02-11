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
- `ColumnMapping`: Direct field-to-field mapping with an optional `transformer` configuration

### Database Tables

| Table | Purpose |
|-------|---------|
| `Sync` | Stores sync configuration including name, mappings JSON, and `lastSyncTime` |
| `SyncTablePair` | Links source/destination DataFolder pairs for a sync |
| `SyncMatchKeys` | Temporary table for matching records during sync execution |
| `SyncRemoteIdMapping` | Persists source→destination record ID mappings |
| `SyncForeignKeyRecord` | Caches referenced records for `lookup_field` transformers (keyed by `syncId`, `dataFolderId`, `foreignKeyValue`) |

## Sync Execution Flow

When `POST /workbooks/:workbookId/syncs/:syncId/run` is called:

### Phase 1: DATA

For each table mapping:

1. **Job Queued**: A background job is enqueued via BullMQ
2. **Clear Match Keys**: Previous match keys for this sync are deleted
3. **Fetch Records**: Files are read from both source and destination DataFolders
4. **Parse Records**: JSON files are parsed into `ConnectorRecord` objects
5. **Fill Caches**: Insert match column values into `SyncMatchKeys` for both sides, then create `SyncRemoteIdMapping` entries for all source records (with null destination for unmatched records) via a SQL LEFT JOIN
6. **Populate FK Record Cache**: For `lookup_field` transformers, fetch records from each referenced DataFolder and cache them in `SyncForeignKeyRecord`. Mappings are grouped by referenced folder to avoid duplicate fetches; all unique FK values across columns referencing the same folder are collected and stored once per `(dataFolderId, foreignKeyValue)` pair.
7. **Get Mappings**: Look up the source→destination ID mappings from `SyncRemoteIdMapping`
8. **Transform & Write**:
   - Column mappings are applied via `transformRecordAsync`, which supports optional transformers on each mapping (see [Transformers](#transformers) below). In this phase, `source_fk_to_dest_fk` passes through raw values while `lookup_field` resolves values from the FK record cache.
   - **New records**: A temporary ID is generated via `createScratchPendingPublishId()` and injected as the record's ID field. The filename is resolved using the destination schema's `slugColumnRemoteId` if available, falling back to the temp ID, and deduplicated against existing filenames. This temp ID allows subsequent syncs to match the record before it's published.
   - **Existing records**: Existing destination fields are merged with the transformed source fields (source takes precedence), preserving destination fields not covered by column mappings. Written to the existing file path.
   - Files are serialized as Prettier-formatted JSON.
9. **Commit**: All file changes are committed to the `DIRTY_BRANCH` via git

### Phase 2: FOREIGN_KEY_MAPPING

After all table mappings complete Phase 1, a second pass runs for any table mapping that has `source_fk_to_dest_fk` columns. This phase re-runs `syncTableMapping` with `phase = 'FOREIGN_KEY_MAPPING'`, which:

- Skips the FK record cache population (not needed)
- Runs `source_fk_to_dest_fk` transformers, which resolve source FK values to destination IDs via `SyncRemoteIdMapping`
- Skips `lookup_field` transformers (already resolved in Phase 1)

This two-phase approach is necessary because destination records must exist (created in Phase 1) before their IDs can be used to resolve foreign key references.

### Finalization

10. **Update lastSyncTime**: On success, the `Sync` record's `lastSyncTime` is updated

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

DTOs are defined in `@spinner/shared-types` (see [packages/shared-types/src/dto/sync/](../../../packages/shared-types/src/dto/sync/)). Key fields:

- `name`: Display name for the sync
- `folderMappings`: Array of source→destination folder mappings, each with:
  - `sourceId`, `destId`: DataFolder IDs
  - `fieldMap`: `FieldMapType` mapping source columns to destination columns. Values can be either a simple `string` (destination field name) or a `FieldMappingValue` object with `destinationField` and an optional `transformer` configuration.
  - `matchingSourceField`, `matchingDestinationField`: Optional columns used for record matching
- `schedule`, `autoPublish`: Accepted but not yet implemented
- `enableValidation` (UpdateSyncDto only): Set to `false` to skip schema validation on update

## Schema Validation

The `validateSchemaMapping()` function in [schema-validator.ts](schema-validator.ts) ensures mapped fields have compatible types:

- Traverses TypeBox JSON schemas using dot-notation paths
- Unwraps `Optional<T>` (union with null) to get base type
- Compares base types (string, number, boolean, object)
- Returns validation errors if types don't match

Validation runs on create and update by default. Set `enableValidation: false` in the update DTO to skip it.

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

## Transformers

Column mappings can include an optional `transformer` configuration that processes source values before writing them to the destination. Transformers are registered in [transformers/](transformers/) and looked up via `getTransformer()`.

Each `ColumnMapping` can specify a `transformer` with:
- `type`: The transformer type identifier
- `options`: An optional key-value bag of transformer-specific configuration

During sync, `transformRecordAsync` applies each mapping's transformer within a `TransformContext` that provides:
- The full source record and field path
- The raw source value
- `LookupTools` for FK resolution
- The current `SyncPhase` (`DATA` or `FOREIGN_KEY_MAPPING`)

If a transformer fails, the record is skipped and an error is added to the sync result.

### Available Transformers

| Type | Phase | Description |
|------|-------|-------------|
| `source_fk_to_dest_fk` | `FOREIGN_KEY_MAPPING` | Resolves a source foreign key ID to the corresponding destination ID via `SyncRemoteIdMapping`. Passes through the raw value in `DATA` phase. Options: `referencedDataFolderId`. |
| `lookup_field` | `DATA` | Looks up a field value from a record referenced by a foreign key using the `SyncForeignKeyRecord` cache. Skips in `FOREIGN_KEY_MAPPING` phase. Options: `referencedDataFolderId`, `referencedFieldPath` (dot-path into the referenced record). |

## Key Files

| File | Description |
|------|-------------|
| [sync.service.ts](sync.service.ts) | Core sync logic |
| [sync.controller.ts](sync.controller.ts) | REST API endpoints |
| [schema-validator.ts](schema-validator.ts) | Schema compatibility checking |
| [transformers/](transformers/) | Transformer registry, types, `LookupTools`, and implementations |
| [shared-types/.../create-sync.dto.ts](../../../packages/shared-types/src/dto/sync/create-sync.dto.ts) | Canonical DTO definitions |

## Limitations

- `schedule` and `autoPublish` are accepted in DTOs but not used
