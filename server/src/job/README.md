# Job Module

## Overview

The job module is a core service layer that manages asynchronous job lifecycle and provides REST endpoints for monitoring and controlling background tasks.

## Purpose

This module functions as an intermediary between user-facing HTTP requests and the underlying BullMQ job queue system powered by Redis. It tracks job progress, state, and allows users to monitor and control their background operations.

## Endpoints

All endpoints are protected by `ScratchpadAuthGuard`:

### `GET /jobs`

Retrieves jobs for the authenticated user with pagination support.

Returns a list of jobs with their current status and metadata.

### `GET /jobs/:jobId/progress`

Fetches real-time job progress and state for a specific job.

Provides detailed information about job execution status.

### `POST /jobs/:jobId/cancel`

Cancels an active job.

Sends cancellation signal via Redis pub/sub to worker processes.

## Job States

Jobs progress through multiple states:

- **active**: Currently executing
- **completed**: Successfully finished
- **failed**: Encountered an error
- **canceled**: User-initiated cancellation

## Core Service

### JobService

Manages job persistence and lifecycle:

- Creates job records with unique IDs and types
- Tracks job status through state transitions
- Stores progress data and error information
- Handles cancellation requests

## Integration with Workers

The Job module works closely with:

- **Worker Module**: Executes actual job logic
- **BullMQ**: Queue system for job distribution
- **QueueService**: Creates and updates job database records
- **Redis Pub/Sub**: Sends cancellation signals to workers

## Conditional Loading

The module is conditionally loaded only when:

- `ScratchpadConfigService.isTaskWorkerService()` returns true
- Service instance runs as a task worker
- Determined by `SERVICE_TYPE` environment variable

This allows the same codebase to run different microservice configurations.

## Job Cancellation

Cancellation flow:

1. User calls cancel endpoint
2. JobService publishes cancellation message to Redis
3. Worker process receives message
4. Worker uses abort controller to stop execution
5. Job state updated to "canceled"

## Database Persistence

All job data is persisted via Prisma:

- Job metadata
- Progress information
- Error details
- Timestamps
- User association

## Use Cases

- Long-running data synchronization
- Bulk operations
- External API polling
- Data transformation
- Report generation
- Export operations

## Dependencies

- **Auth Module**: User authentication
- **Database Module**: Data persistence
- **Config Module**: Service type determination
- **Worker Module**: Job execution
