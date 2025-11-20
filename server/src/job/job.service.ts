/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, NotFoundException } from '@nestjs/common';
import { DbJob } from '@prisma/client';
import IORedis from 'ioredis';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { createJobId } from 'src/types/ids';
import { Progress } from 'src/types/progress';
import { DbService } from '../db/db.service';
import { DbJobStatus, JobEntity } from './entities/job.entity';

@Injectable()
export class JobService {
  private redis: IORedis | null = null;

  constructor(
    private readonly db: DbService,
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

  async createJob(params: {
    userId: string;
    type: string;
    data: Record<string, unknown>;
    bullJobId?: string;
  }): Promise<DbJob> {
    const job = await this.db.client.dbJob.create({
      data: {
        id: createJobId(),
        userId: params.userId,
        type: params.type,
        data: params.data as any,
        bullJobId: params.bullJobId,
        status: 'active',
      },
    });
    return job;
  }

  async updateJobStatus(params: {
    id: string;
    status: DbJobStatus;
    result?: Record<string, unknown>;
    error?: string;
    processedOn?: Date;
    finishedOn?: Date;
    progress?: Progress;
  }): Promise<DbJob> {
    const job = await this.db.client.dbJob.update({
      where: { id: params.id },
      data: {
        status: params.status,
        error: params.error,
        processedOn: params.processedOn,
        finishedOn: params.finishedOn,
        progress: params.progress,
      },
    });

    return job;
  }

  async getJobsByUserId(userId: string, limit = 50, offset = 0): Promise<DbJob[]> {
    const jobs = await this.db.client.dbJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return jobs;
  }

  async getJobById(id: string): Promise<DbJob | null> {
    const job = await this.db.client.dbJob.findUnique({
      where: { id },
    });

    return job;
  }

  async getJobByBullJobId(bullJobId: string): Promise<DbJob | null> {
    const job = await this.db.client.dbJob.findFirst({
      where: { bullJobId },
    });

    return job;
  }

  async getJobProgress(jobId: string): Promise<JobEntity> {
    // Get the job from the queue
    const queue = new (await import('bullmq')).Queue('worker-queue', {
      connection: this.getRedis(),
    });

    const job = await queue.getJob(jobId);

    if (!job) {
      throw new NotFoundException(`Job with id ${jobId} not found`);
    }

    const state = await job.getState();

    return {
      bullJobId: job.id as string,
      dbJobId: job.id as string,
      type: job.name,
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-member-access
      publicProgress: (job.progress as Progress).publicProgress || (job.data as any).initialPublicProgress || undefined,
      state: state,
      processedOn: job.processedOn ? new Date(job.processedOn) : null,
      finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
      failedReason: job.failedReason,
    };
  }

  async cancelJob(jobId: string): Promise<{ success: boolean; message: string }> {
    // Get the job from the queue to verify it exists
    const queue = new (await import('bullmq')).Queue('worker-queue', {
      connection: this.getRedis(),
    });

    const job = await queue.getJob(jobId);

    if (!job) {
      throw new NotFoundException(`Job with id ${jobId} not found`);
    }

    const state = await job.getState();

    // Check if job is already completed or failed
    if (state === 'completed' || state === 'failed') {
      return {
        success: false,
        message: `Job ${jobId} is already ${state}`,
      };
    }

    // Send cancellation message to the job-specific channel
    const channelName = `job-cancel:${jobId}`;
    await this.getRedis().publish(channelName, JSON.stringify({ action: 'cancel', jobId }));

    return {
      success: true,
      message: `Cancellation signal sent for job ${jobId}`,
    };
  }
}
