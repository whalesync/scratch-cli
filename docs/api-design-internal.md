# Scratch Internal API Documentation

## Overview

This document describes internal API endpoints for Scratch, including admin tools, payment integration, OAuth flows, real-time events, and platform-specific operations. These endpoints are not intended for external API consumers.

### Authentication

Internal endpoints use one of:

- **Clerk JWT**: `Authorization: Bearer <jwt_token>` (web app sessions)
- **API Token**: `Authorization: API-Token <token>` (programmatic access)
- **Webhook Signature**: Stripe signature verification (webhooks only)

Some endpoints require **admin role** (`hasAdminToolsPermission`).

---

## Endpoints

### Users

```
GET    /users/current                             # Get current user profile
PATCH  /users/current/settings                    # Update user settings
POST   /users/current/onboarding/collapse         # Collapse onboarding step
```

### Admin Tools

```
GET    /dev-tools/users/search                    # Search users (admin)
GET    /dev-tools/users/:id/details               # Get user details (admin)
PATCH  /dev-tools/users/:id/settings              # Update user settings (admin)
POST   /dev-tools/users/:id/onboarding/reset      # Reset onboarding (admin)
POST   /dev-tools/subscription/plan/update        # Update subscription (admin, non-prod)
POST   /dev-tools/subscription/plan/expire        # Expire subscription (admin, non-prod)
POST   /dev-tools/subscription/plan/cancel        # Cancel subscription (admin, non-prod)
POST   /dev-tools/jobs/sync-data-folders          # Trigger sync job (admin)
```

### Payments

```
GET    /payment/plans                             # List plans (public)
POST   /payment/portal                            # Get Stripe portal URL
POST   /payment/checkout/:planType                # Create checkout session
POST   /payment/webhook                           # Stripe webhook (signature auth)
```

### OAuth

```
POST   /oauth/:service/initiate                   # Get OAuth auth URL
POST   /oauth/:service/callback                   # Handle OAuth callback
POST   /oauth/refresh                             # Refresh OAuth tokens
```

### Git Operations

```
GET    /scratch-git/:id/list                      # List repo files
GET    /scratch-git/:id/file                      # Get file content
GET    /scratch-git/:id/git-status                # Get git status
GET    /scratch-git/:id/git-diff                  # Get file diff
GET    /scratch-git/:id/graph                     # Get commit graph
POST   /scratch-git/:id/checkpoint                # Create checkpoint
GET    /scratch-git/:id/checkpoints               # List checkpoints
POST   /scratch-git/:id/checkpoint/revert         # Revert to checkpoint
DELETE /scratch-git/:id/checkpoint/:name          # Delete checkpoint
```

### Custom Actions

```
POST   /custom-actions/webflow/publish-items      # Publish items to Webflow
POST   /custom-actions/webflow/publish-site       # Publish Webflow site
POST   /custom-actions/webflow/validate-files     # Validate Webflow files
POST   /custom-actions/wix/publish-draft-posts    # Publish Wix draft posts
```

### Style Guides

```
GET    /style-guides/download                     # Download external resource
GET    /style-guides                              # List style guides
POST   /style-guides                              # Create style guide
GET    /style-guides/:id                          # Get style guide
PATCH  /style-guides/:id                          # Update style guide
DELETE /style-guides/:id                          # Delete style guide
PATCH  /style-guides/:id/update-external-resource # Refresh from URL
```

### Code Migrations

```
GET    /code-migrations/available                 # List migrations (admin)
POST   /code-migrations/run                       # Run migration (admin)
```

### Bug Reports

```
POST   /bugs/report                               # Submit bug report
```

### Real-time Events (SSE)

```
GET    /workbook/:id/events                       # Subscribe to workbook events
GET    /workbook/:id/tables/:tableId/records/events # Subscribe to record events
```

### WebSocket

```
WS     /snapshot-events                           # Real-time snapshot updates
```

---

## Endpoint Details

## Users

### Get Current User

```
GET /users/current
```

Returns the authenticated user's profile with subscription and feature flags.

**Response:**

```json
{
  "id": "user_abc123",
  "email": "user@example.com",
  "name": "John Doe",
  "isAdmin": false,
  "createdAt": "2025-01-19T00:00:00.000Z",
  "updatedAt": "2025-01-19T00:00:00.000Z",
  "clerkId": "clerk_xyz",
  "stripeCustomerId": "cus_abc",
  "websocketToken": "ws_token_xyz",
  "subscription": {
    "planType": "pro",
    "status": "active",
    "currentPeriodEnd": "2025-02-19T00:00:00.000Z",
    "cancelAtPeriodEnd": false
  },
  "experimentalFlags": {
    "enableBugReport": true,
    "enableAiFeatures": true
  },
  "organization": {
    "id": "org_123",
    "name": "My Org"
  },
  "settings": {
    "theme": "dark",
    "editorFontSize": 14
  },
  "onboarding": {
    "gettingStartedV1": {
      "dataSourceConnected": { "collapsed": false, "completedAt": null },
      "contentEditedWithAi": { "collapsed": false, "completedAt": null },
      "suggestionsAccepted": { "collapsed": false, "completedAt": null },
      "dataPublished": { "collapsed": false, "completedAt": null }
    }
  },
  "onboardingWorkbookId": "wkb_abc"
}
```

### Update User Settings

```
PATCH /users/current/settings
```

Updates the current user's settings. Set a value to `null` to remove it.

**Request Body:**

```json
{
  "updates": {
    "theme": "light",
    "editorFontSize": 16,
    "oldSetting": null
  }
}
```

**Response:** `204 No Content`

### Collapse Onboarding Step

```
POST /users/current/onboarding/collapse
```

Marks an onboarding step as collapsed or expanded.

**Request Body:**

```json
{
  "flow": "gettingStartedV1",
  "stepKey": "dataSourceConnected",
  "collapsed": true
}
```

| Step Key              | Description                  |
| --------------------- | ---------------------------- |
| `dataSourceConnected` | User connected a data source |
| `contentEditedWithAi` | User edited content with AI  |
| `suggestionsAccepted` | User accepted AI suggestions |
| `dataPublished`       | User published data          |

**Response:** `204 No Content`

---

## Admin Tools

All admin endpoints require the `hasAdminToolsPermission` check (ADMIN role).

### Search Users

```
GET /dev-tools/users/search
```

Searches users by query string.

**Query Parameters:**

| Parameter | Type   | Required | Description                   |
| --------- | ------ | -------- | ----------------------------- |
| `query`   | string | Yes      | Search term (email, name, ID) |

**Response:**

```json
[
  {
    "id": "user_abc",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2025-01-19T00:00:00.000Z"
  }
]
```

### Get User Details

```
GET /dev-tools/users/:id/details
```

Returns comprehensive details for a user including workbooks, connections, and audit logs.

**Response:**

```json
{
  "user": {
    "id": "user_abc",
    "email": "user@example.com",
    "name": "John Doe",
    "isAdmin": false,
    "subscription": {...}
  },
  "workbooks": [
    {
      "id": "wkb_123",
      "name": "My Workbook",
      "createdAt": "2025-01-19T00:00:00.000Z"
    }
  ],
  "connections": [
    {
      "id": "conn_123",
      "service": "airtable",
      "displayName": "My Airtable"
    }
  ],
  "auditLogs": [
    {
      "action": "workbook.created",
      "timestamp": "2025-01-19T00:00:00.000Z",
      "metadata": {...}
    }
  ]
}
```

### Update User Settings (Admin)

```
PATCH /dev-tools/users/:id/settings
```

Updates settings for a specific user.

**Request Body:**

```json
{
  "updates": {
    "theme": "dark"
  }
}
```

**Response:** `204 No Content`

### Reset User Onboarding

```
POST /dev-tools/users/:id/onboarding/reset
```

Resets a user's onboarding to the default state.

**Response:** `204 No Content`

### Update Subscription (Dev Only)

```
POST /dev-tools/subscription/plan/update
```

Updates or creates a subscription. **Non-production environments only.**

**Request Body:**

```json
{
  "planType": "pro"
}
```

| Plan Type    | Description             |
| ------------ | ----------------------- |
| `free`       | Free tier               |
| `pro`        | Pro subscription        |
| `team`       | Team subscription       |
| `enterprise` | Enterprise subscription |

**Response:** Returns updated subscription.

### Expire Subscription (Dev Only)

```
POST /dev-tools/subscription/plan/expire
```

Forces a subscription to expire immediately. **Non-production environments only.**

**Response:** `204 No Content`

### Cancel Subscription (Dev Only)

```
POST /dev-tools/subscription/plan/cancel
```

Cancels a subscription with a 14-day grace period. **Non-production environments only.**

**Response:** `204 No Content`

### Trigger Sync Job

```
POST /dev-tools/jobs/sync-data-folders
```

Manually triggers a sync job for testing.

**Request Body:**

```json
{
  "workbookId": "wkb_abc",
  "syncId": "sync_xyz"
}
```

**Response:**

```json
{
  "success": true,
  "jobId": "job_123",
  "message": "Sync job started"
}
```

---

## Payments

### List Plans (Public)

```
GET /payment/plans
```

Returns available subscription plans. **No authentication required.**

**Response:**

```json
[
  {
    "id": "plan_free",
    "name": "Free",
    "type": "free",
    "price": 0,
    "interval": null,
    "features": ["5 workbooks", "1,000 records"]
  },
  {
    "id": "plan_pro",
    "name": "Pro",
    "type": "pro",
    "price": 29,
    "interval": "month",
    "features": ["Unlimited workbooks", "50,000 records", "Priority support"]
  }
]
```

### Get Portal URL

```
POST /payment/portal
```

Returns a Stripe customer portal URL for managing subscriptions.

**Request Body:**

```json
{
  "portalType": "manage_payment_methods",
  "returnPath": "/settings/billing",
  "planType": "pro"
}
```

| Portal Type              | Description              |
| ------------------------ | ------------------------ |
| `cancel_subscription`    | Cancel subscription flow |
| `update_subscription`    | Change plan flow         |
| `manage_payment_methods` | Update payment methods   |

**Response:**

```json
{
  "url": "https://billing.stripe.com/session/..."
}
```

### Create Checkout Session

```
POST /payment/checkout/:planType
```

Creates a Stripe checkout session for subscription upgrade.

**Request Body:**

```json
{
  "returnPath": "/settings/billing"
}
```

**Response:**

```json
{
  "url": "https://checkout.stripe.com/pay/..."
}
```

**Errors:**

- `400`: Invalid plan type
- `500`: Failed to create checkout session

### Stripe Webhook

```
POST /payment/webhook
```

Handles Stripe webhook events. **No authentication - uses signature verification.**

**Headers:**

| Header             | Required | Description              |
| ------------------ | -------- | ------------------------ |
| `stripe-signature` | Yes      | Stripe webhook signature |

**Request Body:** Raw Stripe event payload

**Response:**

```json
{
  "result": "ok"
}
```

**Errors:**

- `400`: Missing signature or empty body
- `401`: Invalid signature

---

## OAuth

### Initiate OAuth Flow

```
POST /oauth/:service/initiate
```

Returns an OAuth authorization URL.

**Path Parameters:**

| Parameter | Description                                       |
| --------- | ------------------------------------------------- |
| `service` | `airtable`, `notion`, `webflow`, `wix`, `youtube` |

**Request Body:**

```json
{
  "redirectPrefix": "https://app.scratch.io",
  "connectionMethod": "OAUTH_SYSTEM",
  "connectionName": "My Airtable",
  "returnPage": "/connections",
  "connectorAccountId": "conn_123"
}
```

| Field                | Type   | Required | Description                         |
| -------------------- | ------ | -------- | ----------------------------------- |
| `redirectPrefix`     | string | Yes      | Browser origin for OAuth redirect   |
| `connectionMethod`   | string | No       | `OAUTH_SYSTEM` or `OAUTH_CUSTOM`    |
| `customClientId`     | string | No       | Custom OAuth app client ID          |
| `customClientSecret` | string | No       | Custom OAuth app secret             |
| `connectionName`     | string | No       | Display name for connection         |
| `returnPage`         | string | No       | Page to return to after OAuth       |
| `connectorAccountId` | string | No       | Existing connection to re-authorize |

**Response:**

```json
{
  "authUrl": "https://airtable.com/oauth2/v1/authorize?client_id=..."
}
```

### OAuth Callback

```
POST /oauth/:service/callback
```

Handles the OAuth callback after user authorization.

**Request Body:**

```json
{
  "code": "oauth_code_from_provider",
  "state": "state_token_from_initiate"
}
```

**Response:**

```json
{
  "connectorAccountId": "conn_abc123"
}
```

### Refresh OAuth Tokens

```
POST /oauth/refresh
```

Refreshes OAuth tokens for a connection.

**Request Body:**

```json
{
  "connectorAccountId": "conn_123"
}
```

**Response:**

```json
{
  "success": true
}
```

---

## Git Operations

### List Repository Files

```
GET /scratch-git/:id/list
```

Lists files in the git repository.

**Path Parameters:**

| Parameter | Description |
| --------- | ----------- |
| `id`      | Workbook ID |

**Query Parameters:**

| Parameter | Type   | Default | Description |
| --------- | ------ | ------- | ----------- |
| `branch`  | string | `main`  | Git branch  |
| `folder`  | string | ``      | Folder path |

**Response:**

```json
[
  {
    "name": "document.md",
    "type": "file",
    "path": "/docs/document.md",
    "size": 1234
  },
  {
    "name": "images",
    "type": "directory",
    "path": "/images"
  }
]
```

### Get File Content

```
GET /scratch-git/:id/file
```

Gets raw file content from the repository.

**Query Parameters:**

| Parameter | Type   | Required | Description                  |
| --------- | ------ | -------- | ---------------------------- |
| `branch`  | string | No       | Git branch (default: `main`) |
| `path`    | string | Yes      | File path                    |

**Response:**

```json
{
  "content": "# Hello World\n\nFile content here."
}
```

### Get Git Status

```
GET /scratch-git/:id/git-status
```

Returns the current git status of the repository.

**Response:**

```json
{
  "branch": "main",
  "ahead": 0,
  "behind": 0,
  "staged": [],
  "unstaged": [{ "path": "docs/readme.md", "status": "modified" }],
  "untracked": []
}
```

### Get File Diff

```
GET /scratch-git/:id/git-diff
```

Returns the diff for a specific file.

**Query Parameters:**

| Parameter | Type   | Required | Description |
| --------- | ------ | -------- | ----------- |
| `path`    | string | Yes      | File path   |

**Response:**

```json
{
  "path": "docs/readme.md",
  "diff": "@@ -1,3 +1,4 @@\n # Hello\n+New line\n Old content"
}
```

### Get Commit Graph

```
GET /scratch-git/:id/graph
```

Returns the commit history graph.

**Response:**

```json
{
  "commits": [
    {
      "sha": "abc123",
      "message": "Update readme",
      "author": "John Doe",
      "timestamp": "2025-01-19T00:00:00.000Z",
      "parents": ["def456"]
    }
  ]
}
```

### Create Checkpoint

```
POST /scratch-git/:id/checkpoint
```

Creates a named checkpoint (save point) in the repository.

**Request Body:**

```json
{
  "name": "before-major-changes"
}
```

**Response:** `204 No Content`

### List Checkpoints

```
GET /scratch-git/:id/checkpoints
```

Lists all checkpoints for the repository.

**Response:**

```json
[
  {
    "name": "before-major-changes",
    "timestamp": 1705665600000,
    "message": "Checkpoint: before-major-changes"
  },
  {
    "name": "initial-setup",
    "timestamp": 1705579200000,
    "message": "Checkpoint: initial-setup"
  }
]
```

### Revert to Checkpoint

```
POST /scratch-git/:id/checkpoint/revert
```

Reverts the repository to a specific checkpoint.

**Request Body:**

```json
{
  "name": "before-major-changes"
}
```

**Response:** `204 No Content`

### Delete Checkpoint

```
DELETE /scratch-git/:id/checkpoint/:name
```

Deletes a checkpoint.

**Response:** `204 No Content`

---

## Custom Actions

### Webflow: Publish Items

```
POST /custom-actions/webflow/publish-items
```

Publishes specific items to Webflow.

**Request Body:**

```json
{
  "snapshotTableId": "snap_xyz",
  "recordIds": ["rec_123", "rec_456"]
}
```

**Response:** Service-specific response.

### Webflow: Publish Site

```
POST /custom-actions/webflow/publish-site
```

Publishes the entire Webflow site.

**Request Body:**

```json
{
  "snapshotTableId": "snap_xyz"
}
```

**Response:** Service-specific response.

### Webflow: Validate Files

```
POST /custom-actions/webflow/validate-files
```

Validates files before publishing to Webflow.

**Request Body:**

```json
{
  "snapshotTableId": "snap_xyz",
  "recordIds": ["rec_123", "rec_456"],
  "files": [
    {
      "id": "file_abc",
      "content": "{ \"fieldData\": { \"name\": \"Test\" } }"
    }
  ]
}
```

**Response:**

```json
{
  "results": [
    {
      "id": "rec_123",
      "valid": true,
      "errors": []
    },
    {
      "id": "rec_456",
      "valid": false,
      "errors": ["Missing required field: slug"]
    }
  ],
  "summary": {
    "total": 2,
    "publishable": 1,
    "invalid": 1
  }
}
```

### Wix: Publish Draft Posts

```
POST /custom-actions/wix/publish-draft-posts
```

Publishes draft blog posts to Wix.

**Request Body:**

```json
{
  "snapshotTableId": "snap_xyz",
  "recordIds": ["rec_123", "rec_456"]
}
```

**Response:** Service-specific response.

---

## Style Guides

### Download External Resource

```
GET /style-guides/download
```

Downloads content from an external URL.

**Query Parameters:**

| Parameter | Type   | Required | Description     |
| --------- | ------ | -------- | --------------- |
| `url`     | string | Yes      | URL to download |

**Response:** Downloaded content.

### Create Style Guide

```
POST /style-guides
```

Creates a new style guide.

**Request Body:**

```json
{
  "name": "Brand Guidelines",
  "body": "# Brand Guidelines\n\nUse these colors...",
  "autoInclude": true,
  "sourceUrl": "https://example.com/guidelines.md",
  "contentType": "markdown",
  "tags": ["brand", "design"]
}
```

| Field         | Type     | Required | Description                   |
| ------------- | -------- | -------- | ----------------------------- |
| `name`        | string   | Yes      | Style guide name              |
| `body`        | string   | No       | Content body                  |
| `autoInclude` | boolean  | No       | Auto-include in AI prompts    |
| `sourceUrl`   | string   | No       | External source URL           |
| `contentType` | string   | No       | `markdown`, `json`, or `text` |
| `tags`        | string[] | No       | Tags for organization         |

**Response:** Created style guide.

### List Style Guides

```
GET /style-guides
```

Returns all style guides for the user.

**Response:**

```json
[
  {
    "id": "sg_123",
    "name": "Brand Guidelines",
    "autoInclude": true,
    "contentType": "markdown",
    "tags": ["brand"],
    "createdAt": "2025-01-19T00:00:00.000Z"
  }
]
```

### Get Style Guide

```
GET /style-guides/:id
```

Returns a specific style guide with full content.

### Update Style Guide

```
PATCH /style-guides/:id
```

Updates a style guide. All fields are optional.

### Delete Style Guide

```
DELETE /style-guides/:id
```

Deletes a style guide.

**Response:** `204 No Content`

### Refresh External Resource

```
PATCH /style-guides/:id/update-external-resource
```

Re-fetches content from the style guide's `sourceUrl`.

**Response:** Updated style guide.

---

## Code Migrations

Admin-only endpoints for running data migrations.

### List Available Migrations

```
GET /code-migrations/available
```

Returns available migrations that can be run.

**Response:**

```json
{
  "migrations": [
    "migrate-user-settings-v2",
    "backfill-organization-ids",
    "cleanup-orphaned-workbooks"
  ]
}
```

### Run Migration

```
POST /code-migrations/run
```

Runs a code migration.

**Request Body:**

```json
{
  "migration": "migrate-user-settings-v2",
  "qty": 100
}
```

Or with specific IDs:

```json
{
  "migration": "migrate-user-settings-v2",
  "ids": ["user_123", "user_456"]
}
```

| Field       | Type     | Required | Description                  |
| ----------- | -------- | -------- | ---------------------------- |
| `migration` | string   | Yes      | Migration name               |
| `qty`       | number   | No       | Number of records to migrate |
| `ids`       | string[] | No       | Specific IDs to migrate      |

**Note:** Cannot provide both `qty` and `ids`.

**Response:**

```json
{
  "migrationName": "migrate-user-settings-v2",
  "migratedIds": ["user_123", "user_456"],
  "remainingCount": 98
}
```

---

## Bug Reports

### Submit Bug Report

```
POST /bugs/report
```

Submits a bug report. **Requires feature flag `ENABLE_CREATE_BUG_REPORT`.**

**Request Body:**

```json
{
  "title": "Editor crashes on save",
  "bugType": "crash",
  "userDescription": "When I click save, the editor freezes and shows an error.",
  "replayUrl": "https://replay.io/session/abc123",
  "sessionId": "session_xyz",
  "pageUrl": "https://app.scratch.io/workbook/wkb_123",
  "workbookId": "wkb_123",
  "snapshotTableId": "snap_xyz",
  "screenshot": "data:image/png;base64,...",
  "additionalContext": {
    "browserVersion": "Chrome 120",
    "lastAction": "clicked save button"
  }
}
```

**Response:**

```json
{
  "issueId": "SCRATCH-1234",
  "link": "https://linear.app/scratch/issue/SCRATCH-1234"
}
```

**Errors:**

- `403`: Feature flag not enabled for user

---

## Real-time Events (SSE)

Server-Sent Events for real-time updates.

### Workbook Events

```
GET /workbook/:id/events
```

Subscribe to all events for a workbook.

**Event Types:**

```
event: snapshot-event
data: {"type":"table-updated","tableId":"snap_xyz","changes":{...}}

event: snapshot-event
data: {"type":"folder-created","folderId":"folder_abc"}
```

### Record Events

```
GET /workbook/:id/tables/:tableId/records/events
```

Subscribe to record-level changes for a specific table.

**Event Types:**

```
event: record-changes
data: {"tableId":"snap_xyz","numRecords":5,"changeType":"suggested","source":"agent"}
```

| Change Type | Description              |
| ----------- | ------------------------ |
| `suggested` | AI suggested changes     |
| `accepted`  | User accepted changes    |
| `rejected`  | User rejected changes    |
| `manual`    | User made manual changes |

| Source  | Description           |
| ------- | --------------------- |
| `agent` | AI agent made changes |
| `user`  | User made changes     |
| `sync`  | Sync operation        |

---

## WebSocket

Real-time bidirectional communication for snapshot updates.

### Connection

```
WS /snapshot-events
```

**Authentication:** Token in handshake auth object:

```javascript
const socket = io("/snapshot-events", {
  auth: {
    token: "api_token_or_jwt",
  },
});
```

**Configuration:**

| Setting         | Value          |
| --------------- | -------------- |
| Transport       | WebSocket only |
| Ping Timeout    | 60,000ms       |
| Ping Interval   | 25,000ms       |
| Upgrade Timeout | 10,000ms       |

### Messages

**Client to Server:**

| Message     | Payload                  | Description                  |
| ----------- | ------------------------ | ---------------------------- |
| `ping`      | -                        | Keep-alive ping              |
| `subscribe` | `{ workbookId: string }` | Subscribe to workbook events |

**Server to Client:**

| Message                                 | Payload          | Description                   |
| --------------------------------------- | ---------------- | ----------------------------- |
| `pong`                                  | -                | Response to ping              |
| `snapshot-event`                        | Event data       | Snapshot changes              |
| `snapshot-event-subscription-confirmed` | `{ workbookId }` | Subscription confirmed        |
| `record-event`                          | Event data       | Record-level changes          |
| `record-event-subscription-confirmed`   | `{ tableId }`    | Record subscription confirmed |

**Example:**

```javascript
// Subscribe to workbook
socket.emit("subscribe", { workbookId: "wkb_123" });

// Listen for events
socket.on("snapshot-event", (data) => {
  console.log("Snapshot updated:", data);
});

socket.on("record-event", (data) => {
  console.log("Records changed:", data);
});
```

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "Error message",
  "statusCode": 400
}
```

### HTTP Status Codes

| Code | Description                               |
| ---- | ----------------------------------------- |
| 200  | Success                                   |
| 201  | Created                                   |
| 204  | No Content                                |
| 400  | Bad Request                               |
| 401  | Unauthorized                              |
| 403  | Forbidden (no permission or feature flag) |
| 404  | Not Found                                 |
| 500  | Internal Server Error                     |

### Admin Permission Errors

Endpoints requiring admin role return:

```json
{
  "error": "Forbidden",
  "statusCode": 403
}
```

### Feature Flag Errors

Endpoints behind feature flags return:

```json
{
  "error": "Feature not enabled",
  "statusCode": 403
}
```
