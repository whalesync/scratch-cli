# AI Agent Token Usage Module

## Overview

The ai-agent-token-usage module is a NestJS feature module responsible for tracking and monitoring AI token consumption within the application.

## Purpose

This module provides functionality to record token usage events from AI agent interactions and generate usage analytics for individual users. It serves as the telemetry backbone for monitoring AI model costs and usage patterns.

## Endpoints

All endpoints are protected by `ScratchpadAuthGuard`:

### `POST /agent-token-usage/track`

Tracks a new token usage event with:

- Model name
- Request token count
- Response token count
- Optional context data for debugging

### `GET /agent-token-usage/events`

Retrieves paginated historical usage events for the authenticated user using cursor-based pagination.

### `GET /agent-token-usage/stats/summary`

Retrieves aggregated usage statistics for the current calendar month, grouped by model.

## Data Model

Each token usage event includes:

- User ID
- Model name (e.g., "gpt-4", "claude-3-sonnet")
- Request counts
- Token breakdowns (input/output)
- Timestamps
- Optional context information

## Core Service

The `AiAgentTokenUsageService` manages three primary operations:

1. **Creating Events**: Persists new token usage events to the database via Prisma
2. **Retrieving Events**: Fetches all usage events for a user with pagination
3. **Calculating Summaries**: Aggregates usage by model for the current month

## Integration

This module integrates into the broader application architecture as one of several feature modules in the root `app.module.ts`. It sits alongside other user-facing services like payments, snapshots, and authentication.

## Use Cases

- Track AI costs per user
- Enforce usage limits
- Provide users with detailed insights into AI model consumption
- Generate monthly usage reports
- Debug AI agent behavior through context tracking
