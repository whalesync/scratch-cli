# Worker Module

## Overview

The worker module implements a robust job queue and execution system for the application using BullMQ (Redis-based queue) and Piscina (worker thread pool).

## Purpose

This module provides asynchronous job processing capabilities that decouple long-running operations from the main HTTP request-response cycle, enabling scalable background task execution.

## Architecture

### Core Components

#### QueueService

- BullMQ integration for job queuing
- Job lifecycle tracking
- Progress reporting
- Graceful cancellation via Redis pub/sub

#### JobHandlerService

- Factory for instantiating type-safe job handlers
- Dependency injection for services
- Clean handler interface

#### WorkerPoolService

- Piscina management for concurrent execution
- Worker thread pool
- Load distribution

## Job System

### Job Definition

Uses strongly-typed builder pattern:

- Consistent interfaces
- Type-safe job definitions
- Compile-time validation

### Job Types

#### download-records

Fetches and upserts data from external connectors into snapshot database.

**Features:**

- Connector integration
- Progress tracking
- Error handling
- Database upserts

## Job Lifecycle

1. **Creation**: Job record created in database
2. **Queuing**: Added to BullMQ queue
3. **Processing**: Worker picks up job
4. **Progress**: Updates sent via checkpoints
5. **Completion**: Success or failure recorded
6. **Cleanup**: Resources released

## Progress Tracking

### Checkpoints

- Regular progress updates
- Percentage completion
- Status messages
- Error information

### Storage

- Progress persisted to database
- Real-time updates available
- Historical record maintained

## Cancellation Support

### Redis Pub/Sub

- Cancellation messages published
- Workers subscribe to cancellation channel
- Graceful shutdown

### Abort Controllers

- Job functions can check cancellation state
- Clean resource cleanup
- Partial work saved

## Type Safety

### Service Injection

Job handlers receive needed services:

- Prisma client
- ConnectorsService
- SnapshotDbService
- Other dependencies

### Pure Functions

- Testable job logic
- No global dependencies
- Clear service requirements

## Integration

### Snapshot Module

- Downloads snapshot data
- Synchronizes external records
- Updates local database

### Connector Services

- Fetches data from external APIs
- Handles authentication
- Manages rate limits

## Configuration

### Environment Variables

```env
REDIS_HOST=localhost
REDIS_PORT=6379
DATABASE_URL=your_database_url
```

### Worker Pool Settings

- **Max Threads**: 4
- **Min Threads**: 1
- **Idle Timeout**: 30 seconds
- **Max Queue**: 100 jobs

### Queue Settings

- **Concurrency**: 2 jobs
- **Retry Attempts**: 3
- **Backoff**: Exponential (2s delay)
- **Job Retention**: 10 completed, 5 failed

## Database Operations

### Job Records

Stored via Prisma:

- Job metadata
- Status tracking
- Progress information
- Error details
- Timestamps

### Transaction Support

- Atomic operations
- Rollback on failure
- Consistent state

## Error Handling

### Comprehensive Logging

- Error capture
- Stack traces
- Context information
- Retry logic

### Failure States

- Jobs marked as failed
- Error details stored
- Notifications sent
- Retry scheduling

## Concurrency

### Worker Pool

- Multiple concurrent jobs
- Thread isolation
- Resource management
- Load balancing

### Queue Management

- Priority support
- Rate limiting
- Backpressure handling

## Monitoring

### Job Metrics

- Processing time
- Success rate
- Error frequency
- Queue depth

### Progress Visibility

- Real-time status
- Completion percentage
- Time estimates

## Service Type

Conditionally loaded based on:

- `SERVICE_TYPE` environment variable
- Worker service mode
- Monolith mode

## Benefits

- **Scalability**: Horizontal scaling of workers
- **Reliability**: Persistent queue with retry
- **Performance**: Non-blocking async processing
- **Monitoring**: Complete visibility into jobs
- **Cancellation**: User-initiated job stopping
- **Type Safety**: Compile-time job validation
- **Testability**: Pure job functions

## Use Cases

- Data synchronization from external APIs
- Bulk operations
- Long-running computations
- Scheduled tasks
- Report generation
- Data transformation
- External API polling

## Testing

Run the test script to verify the system:

```bash
node test-workers.js
```

## File Structure

```
src/worker/
├── types/
│   └── job-types.ts          # Job type definitions
├── jobs/
│   └── download-records.job.ts  # Download records job
├── worker-entry.ts           # Piscina worker entry point
├── worker-pool.service.ts    # Worker pool management
├── queue.service.ts          # BullMQ queue management
├── job-handler.service.ts    # Job handler factory
├── worker.module.ts          # NestJS module
└── README.md                 # This file
```

## Best Practices

### Job Design

- Keep jobs idempotent
- Handle partial failures
- Report progress regularly
- Clean up resources

### Error Handling

- Log comprehensive context
- Set appropriate retry policies
- Handle transient failures
- Notify on permanent failures

### Performance

- Batch operations when possible
- Use appropriate parallelism
- Monitor queue depth
- Optimize database queries
