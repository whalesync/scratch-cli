/* eslint-disable @typescript-eslint/require-await */
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import { Job, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { JobEntity } from 'src/job/entities/job.entity';
import { JobHandlerService } from 'src/worker/job-handler.service';
import { JobResult, Progress } from 'src/worker/jobs/base-types';
import { JobData } from 'src/worker/jobs/union-types';
import { JobService } from '../job/job.service';
// import { JobHandlerService } from './job-handler.service';
// import { JobResult, Progress } from './jobs/base-types';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private redis: IORedis;
  private pubSubRedis: IORedis;
  private worker: Worker;
  private activeJobs: Map<string, AbortController> = new Map();

  constructor(
    // private readonly workerPool: WorkerPoolService,
    private readonly jobHandlerService: JobHandlerService,
    private readonly jobService: JobService,
  ) {
    this.redis = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
    });

    // Create a separate Redis client for pub/sub operations
    this.pubSubRedis = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
    });
  }

  async onModuleInit() {
    // Create the worker to process jobs
    this.worker = new Worker('worker-queue', async (job: Job) => this.processJob(job), {
      connection: this.redis,
      concurrency: 2, // Process up to 2 jobs concurrently
    });

    // Set up event listeners
    this.worker.on('completed', (job: Job, result: JobResult) => {
      console.log(`Job ${job.id} completed successfully:`, result);
      // Clean up the abort controller when job completes
      if (job.id) {
        this.activeJobs.delete(job.id.toString());
      }
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      console.error(`Job ${job?.id} failed:`, err.message);
      // Clean up the abort controller when job fails
      if (job?.id) {
        this.activeJobs.delete(job.id.toString());
      }
    });

    this.worker.on('error', (err: Error) => {
      console.error('Worker error:', err);
    });

    // Subscribe to job cancellation messages using the separate pub/sub client
    void this.pubSubRedis.psubscribe('job-cancel:*');
    this.pubSubRedis.on('pmessage', (pattern, channel, message) => {
      if (pattern === 'job-cancel:*') {
        this.handleCancellationMessage(channel, message);
      }
    });
  }

  // private getJobTypeFromData(data: JobData): JobType {
  //   switch (data.type) {
  //     case 'download-records':
  //       return JobType.DOWNLOAD_RECORDS;
  //     case 'add-two-numbers':
  //       return JobType.ADD_TWO_NUMBERS;
  //     case 'add-three-numbers':
  //       return JobType.ADD_THREE_NUMBERS;
  //     default:
  //       throw new Error(`Unknown job type: ${data.type}`);
  //   }
  // }

  // private getJobStatusFromBullState(state: string): JobStatus {
  //   switch (state) {
  //     case 'waiting':
  //     case 'delayed':
  //       return JobStatus.PENDING;
  //     case 'active':
  //       return JobStatus.ACTIVE;
  //     case 'completed':
  //       return JobStatus.COMPLETED;
  //     case 'failed':
  //       return JobStatus.FAILED;
  //     default:
  //       return JobStatus.PENDING;
  //   }
  // }

  async processJob(job: Job) {
    const jobData = job.data as JobData;
    const handler = this.jobHandlerService.getHandler(jobData);
    const abortController = new AbortController();

    // Create job record in database
    let dbJob: JobEntity | null = null;
    try {
      dbJob = await this.jobService.createJob({
        userId: jobData.userId || 'unknown', // Extract userId from job data
        type: jobData.type,
        data: jobData,
        bullJobId: job.id?.toString(),
      });
    } catch (error) {
      console.error('Failed to create job record:', error);
    }

    // Store the abort controller for this job
    if (job.id) {
      this.activeJobs.set(job.id.toString(), abortController);
    }

    const checkpoint = async (progress: Progress<any, any, any>) => {
      if (progress) {
        await job.updateProgress({ ...progress, timestamp: Date.now() });
      }
      // Check if job was cancelled
      if (abortController.signal.aborted) {
        throw new JobCanceledError(job.id?.toString() || 'unknown');
      }
    };

    // Update job status to ACTIVE
    if (dbJob) {
      try {
        await this.jobService.updateJobStatus({
          id: dbJob.id,
          status: JobStatus.ACTIVE,
          startedAt: new Date(),
        });
      } catch (error) {
        console.error('Failed to update job status to ACTIVE:', error);
      }
    }

    try {
      const result = await handler.run({
        data: jobData,
        checkpoint,
        progress: job.progress as Progress<any>,
        abortSignal: abortController.signal,
      });

      // Update job status to COMPLETED
      if (dbJob) {
        try {
          await this.jobService.updateJobStatus({
            id: dbJob.id,
            status: JobStatus.COMPLETED,
            result: {},
            completedAt: new Date(),
          });
        } catch (error) {
          console.error('Failed to update job status to COMPLETED:', error);
        }
      }

      return result;
    } catch (error) {
      // Update job status to FAILED or CANCELLED
      if (dbJob) {
        try {
          const status = error instanceof JobCanceledError ? JobStatus.CANCELLED : JobStatus.FAILED;
          await this.jobService.updateJobStatus({
            id: dbJob.id,
            status,
            error: error instanceof Error ? error.message : 'Unknown error',
            completedAt: new Date(),
          });
        } catch (updateError) {
          console.error('Failed to update job status to FAILED/CANCELLED:', updateError);
        }
      }

      if (error instanceof JobCanceledError) {
        console.log(`Job ${job.id} was cancelled:`, error.message);
        throw error;
      }
      console.error(`Job ${job.id} failed:`, error);
      throw error;
    } finally {
      // Clean up the abort controller when job finishes
      if (job.id) {
        this.activeJobs.delete(job.id.toString());
      }
    }
  }

  private handleCancellationMessage(channel: string, message: string) {
    try {
      const data = JSON.parse(message) as { action?: string; jobId?: string };
      if (data.action === 'cancel' && data.jobId) {
        const jobId = data.jobId;
        const abortController = this.activeJobs.get(jobId);

        if (abortController) {
          console.log(`Cancelling job ${jobId}`);
          abortController.abort();
        } else {
          console.log(`Job ${jobId} not found in active jobs or already completed`);
        }
      }
    } catch (error) {
      console.error('Error handling cancellation message:', error);
    }
  }

  async onModuleDestroy() {
    await this.worker.close();
    await this.redis.quit();
    await this.pubSubRedis.quit();
  }
}

export class JobCanceledError extends Error {
  constructor(jobId: string) {
    super(`Job ${jobId} was cancelled`);
    this.name = 'JobCanceledError';
  }
}
