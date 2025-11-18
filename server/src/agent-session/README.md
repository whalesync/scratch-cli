# Agent Session Module

## Overview

The agent-session module is a NestJS service that manages persistent agent session data for the Whalesync application. It provides a REST API for storing, retrieving, and managing agent execution sessions across snapshots.

## Purpose

This module functions as a session persistence layer, allowing users to store agent execution state and context across different snapshots. Each session stores flexible JSON data to accommodate varying agent states and execution contexts.

## Endpoints

All endpoints are protected by `ScratchpadAuthGuard`:

### `POST /agent-sessions`

Creates a new agent session with user ID, snapshot ID, and session data.

### `GET /agent-sessions/:sessionId`

Retrieves a specific session by ID.

### `PUT /agent-sessions/:sessionId`

Updates an existing session's data.

### `DELETE /agent-sessions/:sessionId`

Deletes a session.

### `POST /agent-sessions/:sessionId/upsert`

Upserts (creates or updates) a session for idempotent operations.

### `GET /agent-sessions/user/:userId`

Finds all sessions for a specific user.

### `GET /agent-sessions/workbook/:workbookId`

Finds all sessions associated with a specific snapshot.

## Data Model

Each session stores:

- `id`: Unique session identifier
- `userId`: Associated user ID
- `workbookId`: Associated workbook ID
- `data`: Flexible JSON payload for agent state
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp

## Architecture

The `AgentSessionService` acts as the data access layer, delegating all database operations to the `DbService` using Prisma ORM for type-safe queries.

## Integration

The module is imported into the main AppModule and works alongside the `SnapshotModule` and `AgentJwtModule` to support the broader agent execution and workflow management system.
