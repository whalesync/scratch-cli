import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { WSLogger } from 'src/logger';
import { JobService } from '../job/job.service';
import { JobHandlerService } from './job-handler.service';
import { JobResult, Progress } from './jobs/base-types';
import { JobData } from './jobs/union-types';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private redis: IORedis | null = null;
  private pubSubRedis: IORedis | null = null;
  private worker: Worker | null = null;
  private activeJobs: Map<string, AbortController> = new Map();

  constructor(
    // private readonly workerPool: WorkerPoolService,
    private readonly jobHandlerService: JobHandlerService,
    private readonly jobService: JobService,
    private readonly configService: ScratchpadConfigService,
  ) {}

  private getRedis(): IORedis {
    if (!this.redis) {
      this.redis = new IORedis({
        host: this.configService.getRedisHost(),
        port: this.configService.getRedisPort(),
        password: this.configService.getRedisPassword(),
        maxRetriesPerRequest: null,
      });
    }
    return this.redis;
  }

  private getPubSubRedis(): IORedis {
    if (!this.pubSubRedis) {
      this.pubSubRedis = new IORedis({
        host: this.configService.getRedisHost(),
        port: this.configService.getRedisPort(),
        password: this.configService.getRedisPassword(),
        maxRetriesPerRequest: null,
      });
    }
    return this.pubSubRedis;
  }

  onModuleInit() {
    // Create the worker to process jobs
    this.worker = new Worker('worker-queue', async (job: Job) => this.processJob(job), {
      connection: this.getRedis(),
      concurrency: 2, // Process up to 2 jobs concurrently
    });

    // Set up event listeners
    this.worker.on('completed', (job: Job, result: JobResult) => {
      WSLogger.info({
        source: 'QueueService',
        message: 'Job completed successfully',
        jobId: job.id?.toString(),
        jobType: (job.data as JobData)?.type,
        executionTime: result?.executionTime,
      });
      // Clean up the abort controller when job completes
      if (job.id) {
        this.activeJobs.delete(job.id.toString());
      }
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      WSLogger.error({
        source: 'QueueService',
        message: 'Job failed',
        jobId: job?.id?.toString(),
        jobType: job ? (job.data as JobData)?.type : undefined,
        error: err.message,
        stack: err.stack,
      });
      // Clean up the abort controller when job fails
      if (job?.id) {
        this.activeJobs.delete(job.id.toString());
      }
    });

    this.worker.on('error', (err: Error) => {
      WSLogger.error({
        source: 'QueueService',
        message: 'Worker error',
        error: err.message,
        stack: err.stack,
      });
    });

    // Subscribe to job cancellation messages using the separate pub/sub client
    void this.getPubSubRedis().psubscribe('job-cancel:*');
    this.getPubSubRedis().on('pmessage', (pattern, channel, message) => {
      if (pattern === 'job-cancel:*') {
        this.handleCancellationMessage(channel, message);
      }
    });
  }

  async processJob(job: Job) {
    const jobId = job.id;
    if (!jobId) {
      // Should ever happen. We need the check to make the compiler happy
      WSLogger.error({
        source: 'QueueService',
        message: 'Received an error without id. ',
      });
      throw new Error('Job ID is missing');
    }

    const jobData = job.data as JobData;
    const handler = this.jobHandlerService.getHandler(jobData);
    const abortController = new AbortController();

    WSLogger.info({
      source: 'QueueService',
      message: 'Starting job processing',
      jobId: job.id?.toString(),
      jobType: jobData.type,
      userId: jobData.userId,
    });

    // TODO: This should be creater by the service that enqueues the job
    const dbJob = await this.jobService.createJob({
      userId: jobData.userId || 'unknown',
      type: jobData.type,
      data: jobData,
      bullJobId: job.id?.toString(),
    });

    await this.jobService.updateJobStatus({
      id: dbJob.id,
      status: 'active',
      processedOn: new Date(),
    });

    // const isLastAttempt = job.attemptsStarted < (job.opts.attempts ?? 1);

    this.activeJobs.set(jobId, abortController);

    let latestProgress = job.progress as Progress;
    const checkpoint = async (progress: Progress<any, any, any>) => {
      if (progress) {
        const newProgress = { ...progress, timestamp: Date.now() };
        latestProgress = newProgress;
        await job.updateProgress(newProgress);
      }
      // Check if job was cancelled
      if (abortController.signal.aborted) {
        throw new JobCanceledError(job.id?.toString() || 'unknown');
      }
    };

    try {
      const result = await handler.run({
        data: jobData,
        checkpoint,
        progress: job.progress as Progress<any>,
        abortSignal: abortController.signal,
      });

      await this.jobService.updateJobStatus({
        id: dbJob.id,
        status: 'completed',
        result: {},
        finishedOn: new Date(),
        progress: latestProgress,
      });

      return result;
    } catch (error) {
      // Update job status to FAILED or CANCELLED
      const status = error instanceof JobCanceledError ? 'canceled' : 'failed';
      await this.jobService.updateJobStatus({
        id: dbJob.id,
        status,
        error: error instanceof Error ? error.message : 'Unknown error',
        finishedOn: new Date(),
      });

      if (error instanceof JobCanceledError) {
        WSLogger.warn({
          source: 'QueueService',
          message: 'Job was cancelled',
          jobId,
          error: error.message,
        });
        throw error;
      }
      WSLogger.error({
        source: 'QueueService',
        message: 'Job failed unexpectedly',
        jobId: job.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    } finally {
      this.activeJobs.delete(jobId);
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
    if (this.worker) {
      await this.worker.close();
    }
    if (this.redis) {
      await this.redis.quit();
    }
    if (this.pubSubRedis) {
      await this.pubSubRedis.quit();
    }
  }
}

export class JobCanceledError extends Error {
  constructor(jobId: string) {
    super(`Job ${jobId} was cancelled`);
    this.name = 'JobCanceledError';
  }
}
