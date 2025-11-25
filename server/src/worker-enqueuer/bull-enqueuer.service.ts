import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createPlainId, WorkbookId } from '@spinner/shared-types';
import { Job, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { Actor } from 'src/users/types';
import { DownloadRecordsJobDefinition } from 'src/worker/jobs/job-definitions/download-records.job';
import { PublishRecordsJobDefinition } from 'src/worker/jobs/job-definitions/publish-records.job';
import { JobData } from 'src/worker/jobs/union-types';

@Injectable()
export class BullEnqueuerService implements OnModuleDestroy {
  private redis?: IORedis;
  private queue?: Queue;

  constructor(private readonly configService: ScratchpadConfigService) {
    if (configService.getUseJobs()) {
      this.redis = new IORedis({
        host: this.configService.getRedisHost(),
        port: this.configService.getRedisPort(),
        password: this.configService.getRedisPassword(),
        maxRetriesPerRequest: null,
      });

      this.queue = new Queue('worker-queue', {
        connection: this.redis,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 100,
          attempts: 1,
        },
      });
    }
  }

  async onModuleDestroy() {
    await this.queue?.close();
    await this.redis?.quit();
  }

  private async enqueueJobWithId(data: JobData, id: string): Promise<Job> {
    return await this.getQueue().add(data.type, data, { jobId: id });
  }

  async enqueueJob(data: JobData): Promise<Job> {
    return await this.getQueue().add(data.type, data);
  }

  async enqueueDownloadRecordsJob(workbookId: WorkbookId, actor: Actor, snapshotTableIds?: string[]): Promise<Job> {
    // Generate a simple ID without table names (since we can have 0, 1, or many tables)
    const id = `download-records-${actor.userId}-${workbookId}-${createPlainId()}`;
    const data: DownloadRecordsJobDefinition['data'] = {
      workbookId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      snapshotTableIds,
      type: 'download-records',
    };
    return await this.enqueueJobWithId(data, id);
  }

  async enqueuePublishRecordsJob(
    workbookId: WorkbookId,
    actor: Actor,
    snapshotTableIds?: string[],
    initialPublicProgress?: PublishRecordsJobDefinition['publicProgress'],
  ): Promise<Job> {
    // Generate a simple ID without table names (since we can have 0, 1, or many tables)
    const id = `publish-records-${actor.userId}-${workbookId}-${createPlainId()}`;
    const data: PublishRecordsJobDefinition['data'] = {
      workbookId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      snapshotTableIds,
      type: 'publish-records',
      initialPublicProgress,
    };
    return await this.enqueueJobWithId(data, id);
  }

  private getQueue(): Queue {
    if (!this.queue) {
      throw new Error('Expected queue to not be undefined');
    }
    return this.queue;
  }
}
