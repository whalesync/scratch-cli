/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, NotFoundException } from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import IORedis from 'ioredis';
import { Progress } from 'src/types/progress';
import { DbService } from '../db/db.service';
import { JobEntity, JobProgressEntity } from './entities/job.entity';

@Injectable()
export class JobService {
  private redis: IORedis | null = null;

  constructor(private readonly db: DbService) {}

  private getRedis(): IORedis {
    if (!this.redis) {
      this.redis = new IORedis({
        host: process.env.REDIS_URL || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
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
  }): Promise<JobEntity> {
    const job = await this.db.client.job.create({
      data: {
        id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId: params.userId,
        type: params.type,
        data: params.data as any,
        bullJobId: params.bullJobId,
        status: JobStatus.PENDING,
      },
    });

    return job as JobEntity;
  }

  async updateJobStatus(params: {
    id: string;
    status: JobStatus;
    result?: Record<string, unknown>;
    error?: string;
    startedAt?: Date;
    completedAt?: Date;
  }): Promise<JobEntity> {
    const updateData: any = {
      status: params.status,
      updatedAt: new Date(),
    };

    if (params.result !== undefined) {
      updateData.result = params.result as any;
    }

    if (params.error !== undefined) {
      updateData.error = params.error;
    }

    if (params.startedAt !== undefined) {
      updateData.startedAt = params.startedAt;
    }

    if (params.completedAt !== undefined) {
      updateData.completedAt = params.completedAt;
    }

    const job = await this.db.client.job.update({
      where: { id: params.id },
      data: updateData,
    });

    return job as JobEntity;
  }

  async getJobsByUserId(userId: string, limit = 50, offset = 0): Promise<JobEntity[]> {
    const jobs = await this.db.client.job.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return jobs as JobEntity[];
  }

  async getJobById(id: string): Promise<JobEntity | null> {
    const job = await this.db.client.job.findUnique({
      where: { id },
    });

    return job as JobEntity | null;
  }

  async getJobByBullJobId(bullJobId: string): Promise<JobEntity | null> {
    const job = await this.db.client.job.findFirst({
      where: { bullJobId },
    });

    return job as JobEntity | null;
  }

  async getJobProgress(jobId: string): Promise<JobProgressEntity> {
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
      jobId: job.id as string,
      publicProgress: (job.progress as Progress).publicProgress,
      state: state,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
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
