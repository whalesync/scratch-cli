# scratchmd CLI - LLM Agent Reference

Quick reference for AI agents using the scratchmd CLI programmatically.

## Key Principles

- **Always use `--json`** on commands that support it. JSON goes to **stdout**, errors/progress to **stderr**.
- **Always use `--yes`** on destructive commands (`delete`, `remove`) to skip interactive confirmation prompts.
- **Always use non-interactive flags** for `linked add` (`--connection-id`, `--table-id`, `--name`) — the interactive mode uses terminal prompts that will hang in non-interactive environments.
- **Context auto-detection**: Most commands auto-detect the workbook/data-folder from `.scratchmd` marker files in the current directory (walks upward). Run commands from within the workbook directory to skip passing IDs.
- **Exit codes**: `0` = success, `1` = error (check stderr for message).

---

## Quick Start Workflow

```bash
# 1. Authenticate (one-time, interactive — requires browser)
scratchmd auth login

# 2. List workbooks
scratchmd workbooks list --json

# 3. Initialize a workbook locally (clones files to disk)
scratchmd workbooks init <workbook-id> --json

# 4. Navigate into the workbook directory
cd <WorkbookName>

# 5. Download latest changes from server
scratchmd files download --json

# 6. Edit files locally (markdown, JSON, etc.)

# 7. Upload local changes to server
scratchmd files upload --json

# 8. Pull CRM changes into workbook (async — polls until done, then downloads)
scratchmd linked pull --json

# 9. Publish workbook changes to CRM (async — polls until done, then downloads)
scratchmd linked publish --json
```

---

## All Commands

### Authentication

```bash
scratchmd auth login               # Authenticate (opens browser for OAuth device code flow)
scratchmd auth login --no-browser   # Display URL to visit manually instead of opening browser
scratchmd auth login --server <url> # Authenticate against a specific server
scratchmd auth logout               # Remove stored credentials
scratchmd auth status               # Show current authentication status
```

> **Note**: `auth login` is interactive and requires a browser. No `--json` flag available.

### Workbooks

```bash
scratchmd workbooks list --json                                # List all workbooks
scratchmd workbooks list --json --sort-by name --sort-order asc # Sort by name/createdAt/updatedAt, asc/desc
scratchmd workbooks create --name "My Workbook" --json         # Create a new workbook
scratchmd workbooks show <id> --json                           # Show workbook details
scratchmd workbooks delete <id> --yes                          # Delete a workbook (--yes skips confirmation)
scratchmd workbooks init <id> --json                           # Clone workbook files to local directory
scratchmd workbooks init <id> --json -o ./path                 # Clone to a specific output directory
scratchmd workbooks init <id> --json --force                   # Overwrite existing local copy
```

### Linked Tables

All `linked` subcommands accept `--workbook <id>` to specify the workbook. If omitted, the workbook is auto-detected from the current directory's `.scratchmd` marker.

Commands that take `[id]` auto-detect the data folder ID when run from within a data folder directory.

```bash
# Discovery
scratchmd linked available --json                        # List available tables from all connections
scratchmd linked available <connection-id> --json        # List tables from a specific connection
scratchmd linked available --json --refresh              # Force refresh from connector

# Management
scratchmd linked list --json                             # List linked tables in workbook
scratchmd linked show [id] --json                        # Show linked table details + pending changes
scratchmd linked add --json \                            # Link a table (non-interactive mode)
  --connection-id <conn-id> \
  --table-id <table-id> \
  --name "My Table"
scratchmd linked add --json \                            # Link multiple tables at once
  --connection-id <conn-id> \
  --table-id <id1> --table-id <id2> \
  --name "My Tables"
scratchmd linked remove [id] --json --yes                # Unlink a table (--yes skips confirmation)

# Sync
scratchmd linked pull [id] --json                        # Pull CRM changes into workbook (async)
scratchmd linked publish [id] --json                     # Publish workbook changes to CRM (async)
```

### Files

```bash
scratchmd files download --json              # Download remote changes, three-way merge with local edits
scratchmd files download <workbook-id> --json # Download for a specific workbook (when not in workbook dir)
scratchmd files upload --json                # Upload local changes to server
scratchmd files upload <workbook-id> --json  # Upload for a specific workbook
```

### Global Flags

| Flag | Description |
|------|-------------|
| `-v, --verbose` | Enable verbose output |
| `--config <path>` | Config file path (default: `.scratchmd.config.yaml`) |
| `--scratch-url <url>` | Override scratch server URL |
| `--version` | Show version information |
| `-h, --help` | Show help for any command |

---

## JSON Output Shapes

### workbooks list

```json
{
  "workbooks": [
    { "id": "...", "name": "...", "tableCount": 0, "createdAt": "...", "updatedAt": "..." }
  ],
  "total": 1
}
```

### workbooks create / workbooks show

```json
{ "id": "...", "name": "...", "tableCount": 0, "createdAt": "...", "updatedAt": "...", "gitUrl": "..." }
```

### workbooks init

```json
{ "workbookId": "...", "workbookName": "...", "directory": "./MyWorkbook", "fileCount": 12 }
```

### files download

```json
{
  "status": "downloaded",
  "filesUpdated": 2,
  "filesCreated": 1,
  "filesDeleted": 0,
  "filesMerged": 1,
  "conflictsAutoResolved": 1,
  "messages": []
}
```

`status` is `"downloaded"` or `"up_to_date"`.

### files upload

```json
{
  "status": "uploaded",
  "filesUploaded": 3,
  "filesMerged": 0,
  "filesDeleted": 0,
  "conflictsAutoResolved": 0,
  "retries": 0,
  "messages": []
}
```

`status` is `"uploaded"`, `"no_changes"`, or `"up_to_date"`. `retries` indicates how many optimistic concurrency retries occurred (max 5).

### linked pull / linked publish

```json
{ "jobID": "..." }
```

> **Note**: With `--json`, pull/publish return the job ID immediately and do **not** poll or download. Without `--json`, they poll until completion and then auto-download.

### linked remove

```json
{ "success": true, "id": "...", "name": "..." }
```

### linked show

```json
{
  "id": "...", "name": "...",
  "connectorService": "webflow",
  "connectorDisplayName": "My Webflow",
  "lastSyncTime": "2024-01-15T10:30:00Z",
  "lock": null,
  "hasChanges": true,
  "creates": 2, "updates": 1, "deletes": 0
}
```

---

## Context Detection

The CLI uses `.scratchmd` YAML marker files to auto-detect context:

**Workbook root** (created by `workbooks init`):
```yaml
version: "1"
workbook:
  id: "wb_abc123"
  name: "My Workbook"
  serverUrl: "https://api.scratch.md"
  initializedAt: "2024-01-15T10:30:00Z"
```

**Data folder** (created inside each linked table subdirectory):
```yaml
version: "1"
dataFolder:
  id: "df_abc123"
  name: "Blog Posts"
```

The CLI walks upward from the current directory to find these markers. This means:
- From `MyWorkbook/` — workbook context is detected for `files`, `linked list`, etc.
- From `MyWorkbook/BlogPosts/` — both workbook and data folder context are detected for `linked show`, `linked pull`, etc.

---

## Async Operations (Pull & Publish)

`linked pull` and `linked publish` are async server operations:

- **Without `--json`**: The CLI starts the job, polls every 2s (prints dots to stderr), and auto-runs `files download` on completion. Timeout is 5 minutes.
- **With `--json`**: Returns `{"jobID": "..."}` immediately. The agent must handle polling separately if needed.

---

## Troubleshooting

| Error | Solution |
|-------|----------|
| `"not logged in"` | Run `scratchmd auth login` |
| `"Token expired"` | Run `scratchmd auth login` to get a new token |
| `"not inside a workbook directory"` | Run from a directory with `.scratchmd` marker, or pass the workbook ID explicitly |
| `"upload failed after 5 attempts"` | Concurrent server changes caused all retries to fail; try again |
| Browser doesn't open | Use `--no-browser` flag and visit the URL manually |
| Command hangs | Likely hit an interactive prompt; use `--yes` or non-interactive flags |

## Merge Behavior

- **Three-way merge**: Download and upload both use base/local/remote three-way merge.
- **Local wins**: On conflict, local changes take priority.
- **Text files**: Line-level merge preserving formatting.
- **Binary files**: Atomic replacement (local wins).
- **CRLF normalization**: All text normalized to LF internally for cross-platform consistency.
