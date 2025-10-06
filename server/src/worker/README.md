TODO:
[] Progress

Where jobs will be executed is still a bit of an open question. Some options:

- Inside a separate thread in the worker pool. That means the jobs should not rely on NestJS DI. Also each thread should have its own Prisma instance and db connection pool (bad)
- Inside the main application (nestjs). In this case we cannot uncooperatively cancel a job.
- Inside a lambda somewhere in the cloud. Most complex option.
- In a job workflow management system (like temporal). In this case we will probably need to define the jobs differently, but who knows.

To be most the job definitions should be as pure as possible, getting possible services and dependencies as a parameter.

## Architecture

- **BullMQ**: Job queue management with Redis
- **Piscina**: Worker thread pool for fast job execution

## Configuration

### Environment Variables

```env
REDIS_URL=localhost
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

## Usage

1. **Start Redis**: Make sure Redis is running
2. **Start the server**: `yarn start:dev`
3. **Queue a job**: Send POST request to job endpoints
4. **Monitor progress**: Check job status or queue stats

## Testing

Run the test script to verify the system:

```bash
node test-workers.js
```

## File Structure

```
src/workers/
├── types/
│   └── job-types.ts          # Job type definitions
├── jobs/
│   ├── add-two-numbers.job.ts    # Add two numbers job
│   └── add-three-numbers.job.ts  # Add three numbers job
├── worker-entry.ts           # Piscina worker entry point
├── worker-pool.service.ts    # Worker pool management
├── queue.service.ts          # BullMQ queue management
├── workers.controller.ts     # API endpoints
├── workers.module.ts         # NestJS module
└── README.md                 # This file
```

## Benefits

1. **Fast Startup**: Piscina workers start quickly without NestJS overhead
2. **Database Access**: Workers have direct database access via Prisma
3. **Scalable**: Easy to add new job types and scale worker threads
4. **Reliable**: Built-in retry logic and error handling
5. **Monitorable**: Job status tracking and queue statistics
