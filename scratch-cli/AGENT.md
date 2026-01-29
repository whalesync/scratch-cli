# scratchmd CLI - Agent Reference

This document provides a quick reference for AI agents (Claude, GPT, etc.) using the scratchmd CLI.

## Overview

`scratchmd` syncs local JSON files with CMS platforms (Webflow, WordPress, Airtable, Notion, etc.). Each CMS table/collection maps to a local folder containing JSON files.

## Quick Command Reference

### Discovery Commands (use --json for machine-readable output)

```bash
scratchmd account list [--json]           # List configured CMS accounts
scratchmd account fetch-sources <account> [--json]  # List available tables
scratchmd status [--json]                 # Show pending changes
```

### Setup Commands

```bash
# Add a CMS account
scratchmd account add <name> --provider=<provider> --api-key=<key>

# Providers: webflow, wordpress, airtable, notion, audienceful, moco, youtube, wix-blog

# Link a table to a local folder
scratchmd folder link <folder> --account.name=<account> --table-id=<id>
```

### Content Sync Commands

```bash
# Download content from CMS
scratchmd content download [folder]
scratchmd pull [folder]                   # Alias

# Upload changes to CMS
scratchmd content upload [folder] --no-review [--json]
scratchmd push [folder] --no-review [--json]  # Alias

# Upload including deletions
scratchmd content upload [folder] --sync-deletes --no-review

# Preview without making changes (--dry-run is alias for --simulate)
scratchmd content upload [folder] --dry-run [--json]
```

## JSON Output Examples

### status --json
```json
{
  "folders": [
    {
      "name": "blog-posts",
      "lastDownload": "2024-01-15T10:30:00Z",
      "created": 1,
      "updated": 2,
      "deleted": 0,
      "unchanged": 10,
      "changes": [
        {"file": "new-post.json", "status": "created"},
        {"file": "updated-post.json", "status": "modified"}
      ]
    }
  ],
  "hasChanges": true
}
```

### upload --json
```json
{
  "success": true,
  "results": [
    {"file": "blog-posts/new-post.json", "operation": "create", "id": "abc123", "success": true},
    {"file": "blog-posts/updated-post.json", "operation": "update", "success": true}
  ]
}
```

### account list --json
```json
[
  {"name": "myblog", "id": "acc_123", "provider": "wordpress", "tested": true}
]
```

## File Format

Records are stored as JSON files with the CMS record ID:

```json
{
  "id": 1234,
  "title": "My Post",
  "content": "<p>Hello world</p>",
  "status": "publish"
}
```

The `id` field links the local file to the remote CMS record.

## Typical Workflow

```bash
# 1. Setup (one-time)
scratchmd account add myblog --provider=wordpress \
  --account.endpoint=https://example.com \
  --account.username=user \
  --account.password=app-password

# 2. Discover tables
scratchmd account fetch-sources myblog --json

# 3. Link a table
scratchmd folder link posts --account.name=myblog --table-id=posts

# 4. Download content
scratchmd pull posts

# 5. Edit files in posts/ folder

# 6. Check status
scratchmd status --json

# 7. Upload changes
scratchmd push posts --no-review --json
```

## Important Flags

| Flag | Command | Description |
|------|---------|-------------|
| `--no-review` | upload/push | Skip confirmation prompt (required for automation) |
| `--sync-deletes` | upload/push | Delete remote records when local file removed (DESTRUCTIVE) |
| `--dry-run` | upload/push | Preview changes without executing |
| `--json` | upload/push | Output results as JSON for parsing |
| `--clobber` | download/pull | Delete local files and re-download (DESTRUCTIVE) |
| `--json` | list, fetch-sources, status | Output as JSON for parsing |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (check stderr for details) |

## Provider-Specific Auth Properties

### Webflow
```bash
--provider=webflow --api-key=<api-token>
```

### WordPress
```bash
--provider=wordpress \
  --account.endpoint=https://site.com \
  --account.username=<email> \
  --account.password=<app-password>
```

### Airtable
```bash
--provider=airtable --api-key=<api-token>
```

## When to Prompt the User

- Before using `--sync-deletes` (permanently deletes CMS records)
- Before using `--clobber` (discards local changes)
- When credentials are missing or invalid
- When table linking fails (table ID may be wrong)

## File Naming

Files are named by the `filenameField` configured for the table (usually `slug` or `id`):
- `my-post-slug.json`
- `1234.json`

New files created locally will get an `id` field added after upload.
