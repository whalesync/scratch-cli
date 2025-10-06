import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { createPlainId } from 'src/types/ids';
import { DownloadRecordsJobDefinition } from './jobs/job-definitions/download-records.job';
import { JobData } from './jobs/union-types';

@Injectable()
export class BullEnqueuerService implements OnModuleDestroy {
  private redis: IORedis;
  private queue: Queue;

  constructor() {
    if (process.env.USE_JOBS === 'true') {
      this.redis = new IORedis({
        host: process.env.REDIS_URL || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        maxRetriesPerRequest: null,
      });

      this.queue = new Queue('worker-queue', {
        connection: this.redis,
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 5,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      });
    }
  }

  async onModuleDestroy() {
    await this.queue?.close();
    await this.redis?.quit();
  }

  private async enqueueJobWithId(data: JobData, id: string): Promise<Job> {
    return await this.queue.add(data.type, data, { jobId: id });
  }

  async enqueueJob(data: JobData): Promise<Job> {
    return await this.queue.add(data.type, data);
  }

  async enqueueDownloadRecordsJob(snapshotId: string, userId: string): Promise<Job> {
    const id = `download-records-${userId}-${snapshotId}-${createPlainId()}`;
    const data: DownloadRecordsJobDefinition['data'] = {
      snapshotId,
      userId,
      type: 'download-records',
    };
    return await this.enqueueJobWithId(data, id);
  }
}
