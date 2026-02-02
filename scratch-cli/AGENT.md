# scratchmd CLI - LLM Agent Reference

Quick reference for AI agents using the scratchmd CLI to sync local files with CMS platforms.

## Quick Start

```bash
# One-time setup
scratchmd account add myblog --provider=webflow --api-key=<key>
scratchmd sources myblog --json      # Find table ID
scratchmd init posts --account.name=myblog --table-id=<id>

# Daily workflow
scratchmd pull posts                 # Download from CMS
# ... edit files ...
scratchmd status --json              # Check changes
scratchmd push posts --no-review     # Upload to CMS
```

---

## Command Categories

### DISCOVERY (read-only, safe to run anytime)

| Command | Description | Next Step |
|---------|-------------|-----------|
| `ls --json` | List configured accounts | `sources <account>` |
| `sources <account> --json` | List available CMS tables | `init` |
| `status --json` | Show local changes | `push` if changes |
| `check --json` | Alias for status | `push` if changes |

### SETUP (idempotent, safe to retry)

| Command | Description | Prerequisites |
|---------|-------------|---------------|
| `account add <name> --provider=X --api-key=Y` | Add CMS account | None |
| `init <folder> --account.name=X --table-id=Y` | Link folder to table | Account exists, table ID known |

### SYNC (modifies state)

| Command | Description | Risk Level |
|---------|-------------|------------|
| `pull [folder]` | Download CMS → local | LOW: Only overwrites unchanged files |
| `pull --clobber` | Force re-download | HIGH: Discards ALL local changes |
| `push [folder] --no-review` | Upload local → CMS | MEDIUM: Creates/updates records |
| `push --sync-deletes` | Upload + delete | HIGH: Deletes remote records |

---

## Prerequisites Table

| Command | Requires |
|---------|----------|
| `ls` | None |
| `sources <account>` | Account configured |
| `init` | Account + table ID (from `sources`) |
| `pull` | Folder linked (via `init`) |
| `push` | Folder linked + has content |
| `status` | Folder linked + has content |

---

## Idempotency Reference

| Command | Safe to Retry? | Notes |
|---------|----------------|-------|
| `ls` | Yes | Read-only |
| `sources` | Yes | Read-only |
| `status` | Yes | Read-only |
| `account add` | No | Fails if account exists |
| `init` | No | Fails if folder already linked |
| `pull` | Yes | Merges changes, preserves local edits |
| `push` | Yes | Only uploads changed files |

---

## Decision Trees

### "I need to set up a new CMS connection"

```
START
  │
  ▼
[ls --json] → Do I have an account?
  │
  ├─ NO → [account add <name> --provider=X --api-key=Y]
  │         │
  │         ▼
  │       [sources <account> --json] → Find table ID
  │         │
  │         ▼
  │       [init <folder> --account.name=X --table-id=Y]
  │         │
  │         ▼
  │       [pull <folder>] → Done!
  │
  └─ YES → [sources <account> --json] → (continue from there)
```

### "I want to edit CMS content"

```
START
  │
  ▼
[status --json] → Are there local changes?
  │
  ├─ YES → Review changes, then [push --no-review]
  │
  └─ NO → [pull] to get latest, edit files, then [push]
```

### "I want to sync my changes"

```
START
  │
  ▼
[status --json] → Check what changed
  │
  ├─ hasChanges: true
  │     │
  │     ▼
  │   [push --explain] → Preview what will happen
  │     │
  │     ▼
  │   [push --no-review --json] → Upload changes
  │
  └─ hasChanges: false → Nothing to upload
```

### "Something seems wrong"

```
START
  │
  ▼
What's the error?
  │
  ├─ "Not logged in" → [auth login] or check credentials
  │
  ├─ "Account not found" → [ls] to see available accounts
  │
  ├─ "Table not found" → [sources <account>] to see available tables
  │
  ├─ "Folder not linked" → [init] to link folder
  │
  └─ "No original data" → [pull] to download content first
```

---

## Error Codes

When using `--json` output, errors include machine-parseable codes:

| Code | Meaning | Suggested Action |
|------|---------|------------------|
| `AUTH_FAILED` | Invalid credentials | Check API key, run `account test` |
| `NOT_FOUND` | Resource doesn't exist | Verify account/table/folder name |
| `NOT_CONFIGURED` | Missing setup | Run appropriate setup command |
| `INVALID_INPUT` | Bad parameter | Check command syntax |
| `RATE_LIMITED` | Too many requests | Wait and retry |
| `CONFLICT` | Merge conflict | Review changes, decide resolution |
| `SERVER_ERROR` | CMS API error | Check CMS status, retry later |

---

## JSON Output Examples

### status --json

```json
{
  "state": {
    "accounts": 1,
    "linkedFolders": 2,
    "pendingChanges": 3
  },
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
  "hasChanges": true,
  "nextActions": [
    {"action": "push", "reason": "3 file(s) have local changes"}
  ]
}
```

### push --explain

```json
{
  "action": "upload",
  "folders": ["blog-posts"],
  "files": {
    "blog-posts": [
      {"file": "new-post.json", "operation": "create"},
      {"file": "updated.json", "operation": "update"}
    ],
    "_summary": {"create": 1, "update": 1, "delete": 0}
  },
  "destructive": false,
  "reversible": true,
  "nextSteps": [
    "Run 'push --no-review' to execute this upload",
    "Run 'status --json' to see detailed change list"
  ]
}
```

### push --json (after execution)

```json
{
  "success": true,
  "results": [
    {"file": "blog-posts/new-post.json", "operation": "create", "id": "abc123", "success": true},
    {"file": "blog-posts/updated-post.json", "operation": "update", "success": true}
  ]
}
```

### ls --json (account list)

```json
[
  {"name": "myblog", "id": "acc_123", "provider": "webflow", "tested": true}
]
```

### sources --json (fetch-sources)

```json
[
  {"id": "tbl_abc", "name": "Blog Posts", "linkedFolders": ["blog-posts"]},
  {"id": "tbl_def", "name": "Products", "linkedFolders": []}
]
```

### Error response (--json mode)

```json
{
  "success": false,
  "error": {
    "code": "AUTH_FAILED",
    "message": "Invalid API key",
    "suggestion": "Check your API key and run 'account test <account>'"
  }
}
```

---

## File Format

Records are stored as JSON files with the CMS record ID:

```json
{
  "id": "rec_abc123",
  "title": "My Post",
  "content": "<p>Hello world</p>",
  "status": "publish",
  "slug": "my-post"
}
```

- The `id` field links the local file to the remote CMS record
- Filenames are based on the `slug` or `id` field (e.g., `my-post.json`)
- New files get an `id` field added after first upload

---

## Provider-Specific Auth

### Webflow
```bash
scratchmd account add myblog --provider=webflow --api-key=<token>
```

### WordPress
```bash
scratchmd account add myblog --provider=wordpress \
  --account.endpoint=https://site.com \
  --account.username=<email> \
  --account.password=<app-password>
```

### Airtable
```bash
scratchmd account add mybase --provider=airtable --api-key=<token>
```

---

## Important Flags

| Flag | Commands | Description |
|------|----------|-------------|
| `--json` | Most commands | Machine-readable output |
| `--no-review` | push | Skip confirmation (required for automation) |
| `--explain` | push, pull | Preview without executing |
| `--sync-deletes` | push | Delete remote when local file removed |
| `--clobber` | pull | Discard local changes, re-download |
| `--dry-run` | push | Same as --simulate |

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (check stderr or JSON error field) |

---

## When to Prompt the User

Before proceeding, ask the user to confirm:

- Before `--sync-deletes` (permanently deletes CMS records)
- Before `--clobber` (discards local changes)
- When credentials are missing or invalid
- When table linking fails (table ID may be wrong)
- When conflicts occur during sync
