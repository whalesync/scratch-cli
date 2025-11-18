# Worker Enqueuer Module

## Overview

The worker-enqueuer module is a job queueing service that manages asynchronous background task processing in the Spinner application.

## Purpose

This module provides a wrapper around BullMQ queue management, offering a simple interface for other parts of the application to enqueue background work without dealing with queue complexity.

## Key Component

### BullEnqueuerService

Core service that abstracts BullMQ operations:

- Job enqueueing
- Retry logic configuration
- Job persistence settings
- Redis connectivity

## Primary Use Case

### Workbook Data Downloads

When workbooks are created with multiple tables:

1. User requests snapshot creation
2. Instead of blocking the request
3. Service enqueues "download-records" job
4. Worker processes asynchronously
5. User receives immediate response

## Job Configuration

### Retry Logic

- **Attempts**: Up to 3 retries
- **Backoff**: Exponential backoff strategy
- **Delay**: Increasing delays between retries

### Job Persistence

- **Completed Jobs**: Kept for 10 attempts
- **Failed Jobs**: Kept for 5 attempts
- Automatic cleanup after threshold

### Redis Integration

- Distributed queue management
- Cross-instance coordination
- Persistent job storage

## Integration

### WorkbookService

Primary consumer of the enqueuer:

- Calls `enqueueDownloadRecordsJob()`
- Passes workbook ID
- Includes actor information
- Optional table ID filtering

### Configuration-Based Activation

Conditionally activates via `ScratchpadConfigService.getUseJobs()`:

- **Enabled**: Uses job queue for async processing
- **Disabled**: Falls back to synchronous processing
- Allows environments without Redis/job infrastructure

## Job Parameters

### Download Records Job

- **workbookId**: Target workbook
- **actor**: User/organization context
- **tableIds**: Optional table filtering
- **metadata**: Additional context

## Fallback Strategy

When jobs are disabled:

- Synchronous processing
- Backward compatibility
- No Redis requirement
- Simpler deployment

## Benefits

- **Non-blocking**: Users don't wait for long operations
- **Scalable**: Background work processed independently
- **Reliable**: Retry logic for transient failures
- **Flexible**: Can disable for simple deployments
- **Distributed**: Multiple worker instances supported

## Architecture

### Separation of Concerns

- **Enqueuer**: Adds jobs to queue
- **Worker**: Processes jobs
- **Queue**: Manages job distribution

### Queue as Interface

- Decouples API from processing
- Enables horizontal scaling
- Supports multiple worker instances

## Configuration

### Environment Variables

- Redis connection details
- Use jobs flag
- Retry configuration
- Job retention settings

### Service Type

Works with:

- **Frontend**: Enqueues jobs
- **Worker**: Processes jobs
- **Monolith**: Does both

## Error Handling

### Enqueueing Errors

- Redis connection failures
- Invalid job parameters
- Queue full scenarios

### Job Failures

- Automatic retry with backoff
- Failure persistence
- Error logging

## Monitoring

### Job Metrics

- Enqueued count
- Processing time
- Success/failure rates
- Queue depth

### Visibility

- Job status tracking
- Progress updates
- Completion notifications

## Use Cases

- Snapshot data downloads
- Bulk operations
- External API calls
- Long-running tasks
- Data synchronization
- Report generation

## Integration Pattern

```typescript
// In service
constructor(private enqueuer: BullEnqueuerService) {}

async createSnapshot() {
  // Create snapshot metadata
  const snapshot = await this.create();

  // Enqueue background download
  await this.enqueuer.enqueueDownloadRecordsJob({
    workbookId: workbook.id,
    actor: currentUser,
  });

  // Return immediately
  return snapshot;
}
```

## Deployment Flexibility

### With Job Queue

- Best for production
- Scalable architecture
- Multiple workers

### Without Job Queue

- Simple deployments
- Single server setups
- Development/testing

## Future Extensions

Easy to add new job types:

1. Define job interface
2. Add enqueue method
3. Create job handler
4. Configure queue settings

## Best Practices

### When to Use Jobs

- Operations taking > 2 seconds
- External API calls
- Bulk data processing
- User-initiated async tasks

### When to Skip Jobs

- Simple operations
- Critical path logic
- Real-time requirements
- Development/testing
