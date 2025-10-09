import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { createPlainId } from 'src/types/ids';
import { DownloadRecordsJobDefinition } from './jobs/job-definitions/download-records.job';
import { JobData } from './jobs/union-types';

@Injectable()
export class BullEnqueuerService implements OnModuleDestroy {
  private redis: IORedis;
  private queue: Queue;

  constructor(private readonly configService: ScratchpadConfigService) {
    if (process.env.USE_JOBS === 'true') {
      this.redis = new IORedis({
        host: this.configService.getRedisHost(),
        port: this.configService.getRedisPort(),
        password: this.configService.getRedisPassword(),
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
