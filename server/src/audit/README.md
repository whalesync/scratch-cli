# Audit Module

## Overview

The audit module is a NestJS-based service that provides comprehensive event tracking and logging capabilities for the application.

## Purpose

This module serves as a critical audit trail mechanism for compliance, debugging, and operational visibility, capturing who performed what actions and when across the platform.

## Key Components

### AuditLogService

The main service provides three core methods:

1. **logEvent()**: Records new audit events with:
   - User ID
   - Organization ID
   - Event type
   - Descriptive message
   - Affected entity ID
   - Optional context data (JSON)

2. **findEventsForUser()**: Retrieves paginated audit events for a specific user using cursor-based pagination

3. **findEventsForOrganization()**: Retrieves paginated events for an entire organization

## Event Types

The module defines four event types:

- `create`: Entity creation events
- `update`: Entity modification events
- `delete`: Entity deletion events
- `publish`: Publishing/deployment events

## Data Model

Each audit event includes:

- Event type
- User who performed the action
- Organization context
- Descriptive message
- Entity ID (the affected resource)
- Timestamp
- Optional context data for additional details

## Integration Points

### SnapshotService

Logs major operations including:

- Snapshot creation
- Snapshot updates
- Snapshot deletions
- Snapshot publishing

### Dev-Tools

The admin endpoint `GET /dev-tools/users/:id/details` retrieves the last 20 audit events for a user as part of user detail inspection.

## Architecture

The service interacts with the underlying database via the `DbService` using Prisma ORM for type-safe queries. All audit data is persisted to the `AuditLogEvent` table for long-term retention.

## Use Cases

- Compliance and regulatory requirements
- Security auditing
- Debugging user actions
- Understanding system usage patterns
- Tracking data modifications
