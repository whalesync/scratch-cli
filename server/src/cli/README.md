# CLI Module

This module provides REST API endpoints for the Scratch CLI tool to interact with data connectors.

## Authentication

All endpoints in this module require CLI authentication via the `CliAuthGuard`.

### Required Headers

| Header                | Required    | Description                                                                |
| --------------------- | ----------- | -------------------------------------------------------------------------- |
| `User-Agent`          | Yes         | Must be exactly `Scratch-CLI/1.0`                                          |
| `X-Scratch-Connector` | Conditional | JSON object containing connector credentials (required for many endpoints) |

### X-Scratch-Connector Header Format

```json
{
  "service": "webflow",
  "params": {
    "apiKey": "your-webflow-api-key"
  }
}
```

- `service` (required): The connector service type (e.g., `webflow`, `webflow`, `bigquery`)
- `params` (optional): Key-value pairs of connection parameters specific to the service

## Endpoints

All endpoints are prefixed with `/cli/v1`.

### GET /cli/v1/health

Health check endpoint that returns the service status.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "scratch-cli",
  "build_version": "1.0.0",
  "api_version": "1"
}
```

### GET /cli/v1/test-credentials

Tests the provided connector credentials to verify they can establish a connection.

**Headers:**

- `X-Scratch-Connector`: Required

**Response:**

```json
{
  "success": true,
  "service": "webflow"
}
```

**Error Response:**

```json
{
  "success": false,
  "service": "webflow",
  "error": "Connection refused"
}
```

### GET /cli/v1/list-tables

Lists all available tables for the connected data source.

**Headers:**

- `X-Scratch-Connector`: Required

**Response:**

```json
{
  "success": true,
  "service": "webflow",
  "tables": [
    {
      "id": { "wsId": "table1", "remoteId": ["public", "users"] },
      "displayName": "users",
      "description": "User accounts table"
    }
  ]
}
```

### GET /cli/v1/fetch-table-spec

Fetches the full schema specification for a specific table.

**Headers:**

- `X-Scratch-Connector`: Required

**Parameters:**

- `tableId`: The table identifier

**Response:**

```json
{
  "success": true,
  "service": "webflow",
  "tableSpec": {
    "id": { "wsId": "table1", "remoteId": ["public", "users"] },
    "displayName": "users",
    "columns": [...]
  }
}
```

### GET /cli/v1/list-table-specs

Lists all tables with their full schema specifications.

**Headers:**

- `X-Scratch-Connector`: Required

**Response:**

```json
{
  "success": true,
  "service": "webflow",
  "tables": [
    {
      "id": { "wsId": "table1", "remoteId": ["public", "users"] },
      "displayName": "users",
      "columns": [...]
    }
  ]
}
```

## Example Usage

```bash
# Health check
curl -H "User-Agent: Scratch-CLI/1.0" \
  http://localhost:3010/cli/v1/health

# Test credentials
curl -X POST \
  -H "User-Agent: Scratch-CLI/1.0" \
  -H "X-Scratch-Connector: {\"service\":\"webflow\",\"params\":{\"apiKey\":\"your-webflow-api-key\"}}" \
  http://localhost:3010/cli/v1/test-credentials

# List tables
curl -H "User-Agent: Scratch-CLI/1.0" \
  -H "X-Scratch-Connector: {\"service\":\"webflow\",\"params\":{\"apiKey\":\"your-webflow-api-key\"}}" \
  http://localhost:3010/cli/v1/list-tables
```

## Error Handling

All endpoints return a consistent error format:

```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "service": "webflow"
}
```

Common errors:

- `401 Unauthorized`: Invalid or missing `User-Agent` header
- `400 Bad Request`: Invalid JSON in `X-Scratch-Connector` header
- `Service is required in X-Scratch-Connector header`: Missing service field in connector header
