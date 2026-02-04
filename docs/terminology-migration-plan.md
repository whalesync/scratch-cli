# Terminology Migration: "Download/Refresh" to "Pull"

## Overview

Align Spinner terminology with Mackerel's data flow definitions:

| Term         | Direction                               | Example                                |
| ------------ | --------------------------------------- | -------------------------------------- |
| **Pull**     | Remote API → Scratch storage            | "Pull data from Airtable into Scratch" |
| **Publish**  | Scratch storage → Remote API            | "Publish changes back to Webflow"      |
| **Download** | Scratch storage → User's local computer | "Download files to your computer"      |
| **Upload**   | User's local computer → Scratch storage | "Upload files from your computer"      |

**Problem:** Spinner currently uses "download" and "refresh" where it should say "pull".

## Scope Summary

| Area        | Files       | Key Changes                                              |
| ----------- | ----------- | -------------------------------------------------------- |
| Server      | ~35 files   | Job definitions, connectors, services, controllers, DTOs |
| Client      | ~15 files   | Components, API layer, store, UI text                    |
| scratch-cli | ~5 files    | API client, workbook command, types                      |
| Database    | 1 migration | Update `lock` field values: `'download'` → `'pull'`      |

---

## Phase 1: Database Migration

### 1.1 Create Prisma Migration

Create `server/prisma/migrations/[timestamp]_rename_download_to_pull/migration.sql`:

```sql
-- Rename lock value from 'download' to 'pull'
UPDATE "SnapshotTable" SET lock = 'pull' WHERE lock = 'download';
UPDATE "DataFolder" SET lock = 'pull' WHERE lock = 'download';
```

### 1.2 Update Prisma Schema Comments

**File:** `server/prisma/schema.prisma`

Update comments at lines ~245 and ~495:

- `"download"` → `"pull"` in lock field documentation

---

## Phase 2: Server - Connector Base Class

**File:** `server/src/remote-service/connectors/connector.ts`

Rename abstract methods:

- `downloadTableRecords()` → `pullTableRecords()`
- `downloadRecordFiles()` → `pullRecordFiles()`
- `downloadRecordDeep()` → `pullRecordDeep()`

Update JSDoc comments to say "Pull" instead of "Download".

---

## Phase 3: Server - Connector Implementations

Rename method implementations in all connectors:

| File                                           | Methods                                                 |
| ---------------------------------------------- | ------------------------------------------------------- |
| `library/airtable/airtable-connector.ts`       | `pullTableRecords`, `pullRecordFiles`                   |
| `library/notion/notion-connector.ts`           | `pullTableRecords`, `pullRecordFiles`                   |
| `library/webflow/webflow-connector.ts`         | `pullTableRecords`, `pullRecordFiles`                   |
| `library/wordpress/wordpress-connector.ts`     | `pullTableRecords`, `pullRecordFiles`                   |
| `library/wix/wix-blog/wix-blog-connector.ts`   | `pullTableRecords`, `pullRecordFiles`                   |
| `library/audienceful/audienceful-connector.ts` | `pullTableRecords`, `pullRecordFiles`                   |
| `library/youtube/youtube-connector.ts`         | `pullTableRecords`, `pullRecordFiles`, `pullRecordDeep` |
| `library/moco/moco-connector.ts`               | `pullTableRecords`, `pullRecordFiles`                   |

---

## Phase 4: Server - Job Definitions

### 4.1 Rename Files

| Old                                                               | New                               |
| ----------------------------------------------------------------- | --------------------------------- |
| `worker/jobs/job-definitions/download-files.job.ts`               | `pull-files.job.ts`               |
| `worker/jobs/job-definitions/download-record-files.job.ts`        | `pull-record-files.job.ts`        |
| `worker/jobs/job-definitions/download-linked-folder-files.job.ts` | `pull-linked-folder-files.job.ts` |

### 4.2 Update Contents

**pull-files.job.ts:**

- `DownloadFilesPublicProgress` → `PullFilesPublicProgress`
- `DownloadFilesJobDefinition` → `PullFilesJobDefinition`
- `DownloadFilesJobHandler` → `PullFilesJobHandler`
- Job type: `'download-files'` → `'pull-files'`
- Lock values: `'download'` → `'pull'`
- Log messages and WSLogger source names

**pull-record-files.job.ts:**

- `DownloadRecordFilesPublicProgress` → `PullRecordFilesPublicProgress`
- `DownloadRecordFilesJobDefinition` → `PullRecordFilesJobDefinition`
- `DownloadRecordFilesJobHandler` → `PullRecordFilesJobHandler`
- Job type: `'download-record-files'` → `'pull-record-files'`

**pull-linked-folder-files.job.ts:**

- `DownloadLinkedFolderFilesPublicProgress` → `PullLinkedFolderFilesPublicProgress`
- `DownloadLinkedFolderFilesJobDefinition` → `PullLinkedFolderFilesJobDefinition`
- `DownloadLinkedFolderFilesJobHandler` → `PullLinkedFolderFilesJobHandler`
- Job type: `'download-linked-folder-files'` → `'pull-linked-folder-files'`

---

## Phase 5: Server - Worker Infrastructure

### 5.1 union-types.ts

**File:** `server/src/worker/jobs/union-types.ts`

- Update imports to new file names
- Update type names in union

### 5.2 job-handler.service.ts

**File:** `server/src/worker/job-handler.service.ts`

- Update imports
- Update switch cases: `'download-files'` → `'pull-files'`, etc.
- Update class instantiations

### 5.3 bull-enqueuer.service.ts

**File:** `server/src/worker-enqueuer/bull-enqueuer.service.ts`

Rename methods:

- `enqueueDownloadFilesJob()` → `enqueuePullFilesJob()`
- `enqueueDownloadRecordFilesJob()` → `enqueuePullRecordFilesJob()`
- `enqueueDownloadLinkedFolderFilesJob()` → `enqueuePullLinkedFolderFilesJob()`

Update job ID prefixes and type references.

---

## Phase 6: Server - Services

### 6.1 workbook.service.ts

**File:** `server/src/workbook/workbook.service.ts`

- `downloadFiles()` → `pullFiles()`
- Lock value: `'download'` → `'pull'`
- Method calls to bull-enqueuer

### 6.2 data-folder.service.ts

**File:** `server/src/workbook/data-folder.service.ts`

- Lock value: `'download'` → `'pull'`
- Method calls to bull-enqueuer
- Log messages

### 6.3 cli.service.ts

**File:** `server/src/cli/cli.service.ts`

- `triggerDownload()` → `triggerPull()`
- Lock value: `'download'` → `'pull'`
- Method calls and log messages

---

## Phase 7: Server - Controllers

### 7.1 workbook.controller.ts

**File:** `server/src/workbook/workbook.controller.ts`

- Endpoint: `@Post(':id/download-files')` → `@Post(':id/pull-files')`
- Method: `downloadFiles()` → `pullFiles()`
- DTO: `DownloadFilesDto` → `PullFilesDto`

### 7.2 cli.controller.ts

**File:** `server/src/cli/cli.controller.ts`

- Endpoint: `@Post('workbooks/:workbookId/download')` → `@Post('workbooks/:workbookId/pull')`
- Method names and DTO references

---

## Phase 8: Server - DTOs

### 8.1 Rename Files

| Old                                | New                   |
| ---------------------------------- | --------------------- |
| `cli/dtos/download-files.dto.ts`   | `pull-files.dto.ts`   |
| `cli/dtos/trigger-download.dto.ts` | `trigger-pull.dto.ts` |
| `cli/dtos/download-folder.dto.ts`  | `pull-folder.dto.ts`  |

### 8.2 Update Class Names

- `DownloadRequestDto` → `PullRequestDto`
- `DownloadedFilesResponseDto` → `PulledFilesResponseDto`
- `TriggerDownloadDto` → `TriggerPullDto`
- `TriggerDownloadResponseDto` → `TriggerPullResponseDto`

---

## Phase 9: Client - Rename Component Files

### 9.1 Rename Directory and Files

| Old                              | New                          |
| -------------------------------- | ---------------------------- |
| `components/jobs/download/`      | `components/jobs/pull/`      |
| `DownloadJobProgress.ts`         | `PullJobProgress.ts`         |
| `DownloadJobProgressDisplay.tsx` | `PullJobProgressDisplay.tsx` |
| `DownloadJobProgressModal.tsx`   | `PullJobProgressModal.tsx`   |

### 9.2 Rename Modal

| Old                                | New                             |
| ---------------------------------- | ------------------------------- |
| `modals/RefreshTableDataModal.tsx` | `modals/PullTableDataModal.tsx` |

---

## Phase 10: Client - Update Component Contents

### 10.1 PullJobProgress.ts

- `DownloadRecordsProgress` → `PullRecordsProgress`
- `DownloadFilesProgress` → `PullFilesProgress`
- `DownloadProgress` → `PullProgress`
- `isDownloadFilesProgress()` → `isPullFilesProgress()`

### 10.2 PullJobProgressDisplay.tsx

- Update imports and type references
- UI text: `"Download Failed"` → `"Pull Failed"`

### 10.3 PullJobProgressModal.tsx

- `DownloadProgressModal` → `PullProgressModal`
- UI text updates:
  - `"Refresh completed successfully!"` → `"Pull completed successfully!"`
  - `"Refresh failed:"` → `"Pull failed:"`
  - `"Cancel Download"` → `"Cancel Pull"`

### 10.4 PullTableDataModal.tsx

- `RefreshTableDataModal` → `PullTableDataModal`
- `ConfirmRefreshModal` → `ConfirmPullModal`
- State: `refreshInProgress` → `pullInProgress`
- Function: `startRefresh()` → `startPull()`
- UI text:
  - `"Select folders to refresh"` → `"Select folders to pull"`
  - `"Refresh data"` → `"Pull data"`
  - `"Refresh failed"` → `"Pull failed"`
  - Error messages updated

---

## Phase 11: Client - API Layer

### 11.1 workbook.ts

**File:** `client/src/lib/api/workbook.ts`

- `downloadFiles()` → `pullFiles()`
- Endpoint: `/workbook/${id}/download-files` → `/workbook/${id}/pull-files`
- Error message: `"Failed to start files download"` → `"Failed to start files pull"`

### 11.2 Types

**File:** `client/src/types/server-entities/workbook.ts`

- `DownloadWorkbookResult` → `PullWorkbookResult`

---

## Phase 12: Client - Store

**File:** `client/src/stores/workbook-editor-store.ts`

- `CONFIRM_REFRESH_SOURCE` → `CONFIRM_PULL_SOURCE`

---

## Phase 13: Client - Update All Imports

Update imports in files that reference renamed components:

- `WorkbookEditorModals.tsx`
- `DataFolderFileList.tsx` (lock state checks: `'download'` → `'pull'`)
- `WorkbookFileBrowser.tsx`
- Any other files with imports

---

## Phase 14: Client - Additional UI Text

**File:** `client/src/app/workbooks/[...slug]/components/DataFolderFileList.tsx`

- Lock state checks: `'download'` → `'pull'`
- Loading message: `"Download in progress..."` → `"Pull in progress..."`

**File:** `client/src/app/components/jobs/SyncStatus/sync-status.tsx`

- `"${doneCount} records downloaded"` → `"${doneCount} records pulled"`

---

## Phase 15: scratch-cli (Go CLI)

The standalone Go CLI (`scratchmd`) needs updates to match the new server API endpoints.

**Note:** The direct provider flow (`content download`, `pull` command alias) will be removed in a separate effort. Do not modify those commands as part of this migration.

### 15.1 Rename Command: `workbook sync` → `workbook pull`

**File:** `scratch-cli/internal/cmd/workbook.go`

- Rename `workbookSyncCmd` → `workbookPullCmd`
- Change `Use: "sync <workbook-id>"` → `Use: "pull <workbook-id>"`
- Update Short: `"[NON-INTERACTIVE] Sync (download) records..."` → `"[NON-INTERACTIVE] Pull records from a data folder"`
- Update Long description to say "pull" instead of "sync/download"
- Rename `runWorkbookSync` → `runWorkbookPull`
- Rename `SyncResult` struct → `PullResult` (or keep as generic result type)
- Update output messages: `"Downloaded %d files"` → `"Pulled %d files"`

### 15.2 Update API Client Types

**File:** `scratch-cli/internal/api/client.go`

- `TriggerDownloadRequest` → `TriggerPullRequest`
- `TriggerDownloadResponse` → `TriggerPullResponse`
- `TriggerWorkbookDownload()` → `TriggerWorkbookPull()`
- Update endpoint path: `workbooks/%s/download` → `workbooks/%s/pull`
- `SyncOperationDownload` constant → `SyncOperationPull` (value: `"pull"`)

### 15.3 Update Documentation

**Files to update:**

- `scratch-cli/AGENT.md` - Command reference for AI agents
- `scratch-cli/README.md` - User documentation
- `scratch-cli/CLAUDE.md` - Development context
- `scratch-cli/internal/cmd/root.go` - Root command help text

Update all references from:

- "workbook sync" → "workbook pull"
- "download" (in context of remote API → Scratch) → "pull"

### 15.4 Note: Direct Provider Flow (DO NOT MODIFY)

The following will be removed separately and should NOT be touched:

- `content download` command
- `pull` command (alias for `content download`)
- `internal/download/` package
- Related provider download methods

---

## Verification

### Build Checks

```bash
# Server
cd server && yarn build && yarn lint

# Client
cd client && yarn build && yarn lint
```

### Database Migration

```bash
cd server && yarn prisma migrate dev
```

### Integration Test

1. Start dev servers: `cd server && yarn start:dev` and `cd client && yarn dev`
2. Create a workbook with a connected table (e.g., Airtable)
3. Click "Pull data" button (formerly "Refresh data")
4. Verify UI shows "Pull in progress..." and "Pull completed successfully!"
5. Check database: `SELECT lock FROM "SnapshotTable"` should show `'pull'` during operation

### scratch-cli Build

```bash
cd scratch-cli && go build -o scratchmd ./cmd/scratchmd
```

### scratch-cli Integration Test

1. Build the CLI: `cd scratch-cli && go build -o scratchmd ./cmd/scratchmd`
2. Authenticate: `./scratchmd auth login`
3. Run pull command: `./scratchmd workbook pull <workbook-id> --folder <folder-id>`
4. Verify it calls the new `/pull` endpoint and shows "Pulled X files"

### Grep for Stragglers

```bash
# After migration, search for remaining instances
grep -ri "download" server/src --include="*.ts" | grep -v "node_modules" | grep -v ".d.ts"
grep -ri "refresh" client/src --include="*.tsx" | grep -v "node_modules"
grep -ri "download" scratch-cli/internal --include="*.go" | grep -v "content download"  # exclude deprecated flow
```

---

## Files Summary (Critical Path)

### Server (in order)

1. `server/prisma/schema.prisma` - comments
2. `server/src/remote-service/connectors/connector.ts` - abstract methods
3. `server/src/remote-service/connectors/library/*/` - all connector implementations
4. `server/src/worker/jobs/job-definitions/download-*.job.ts` - rename files + contents
5. `server/src/worker/jobs/union-types.ts` - type union
6. `server/src/worker/job-handler.service.ts` - switch cases
7. `server/src/worker-enqueuer/bull-enqueuer.service.ts` - enqueue methods
8. `server/src/workbook/workbook.service.ts` - service method
9. `server/src/workbook/workbook.controller.ts` - REST endpoint
10. `server/src/workbook/data-folder.service.ts` - lock values
11. `server/src/cli/cli.service.ts` - CLI methods
12. `server/src/cli/cli.controller.ts` - CLI endpoints
13. `server/src/cli/dtos/download-*.dto.ts` - rename files + classes

### Client (in order)

1. `client/src/app/components/jobs/download/` - rename directory + all files
2. `client/src/app/workbooks-md/[...slug]/components/modals/RefreshTableDataModal.tsx` - rename + contents
3. `client/src/lib/api/workbook.ts` - API method
4. `client/src/stores/workbook-editor-store.ts` - modal enum
5. `client/src/types/server-entities/workbook.ts` - type name
6. All files with imports to update

### scratch-cli (in order)

1. `scratch-cli/internal/api/client.go` - API client types and methods
2. `scratch-cli/internal/cmd/workbook.go` - `workbook pull` command (was `workbook sync`)
3. `scratch-cli/AGENT.md` - AI agent documentation
4. `scratch-cli/README.md` - User documentation
5. `scratch-cli/internal/cmd/root.go` - Root help text

### Database

1. Create migration: `server/prisma/migrations/[timestamp]_rename_download_to_pull/migration.sql`
