import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createPlainId, DataFolderId, WorkbookId } from '@spinner/shared-types';
import { Job, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { Actor } from 'src/users/types';
import { DownloadFilesJobDefinition } from 'src/worker/jobs/job-definitions/download-files.job';
import { PublishFilesJobDefinition } from 'src/worker/jobs/job-definitions/publish-files.job';
import { JobData } from 'src/worker/jobs/union-types';
import { DownloadLinkedFolderFilesJobDefinition } from '../worker/jobs/job-definitions/download-linked-folder-files.job';
import { DownloadRecordFilesJobDefinition } from '../worker/jobs/job-definitions/download-record-files.job';

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

  async enqueueDownloadFilesJob(
    workbookId: WorkbookId,
    actor: Actor,
    snapshotTableIds?: string[],
    initialPublicProgress?: DownloadFilesJobDefinition['publicProgress'],
  ): Promise<Job> {
    // Generate a simple ID without table names (since we can have 0, 1, or many tables)
    const id = `download-files-${actor.userId}-${workbookId}-${createPlainId()}`;
    const data: DownloadFilesJobDefinition['data'] = {
      workbookId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      snapshotTableIds,
      type: 'download-files',
      initialPublicProgress,
    };
    return await this.enqueueJobWithId(data, id);
  }

  async enqueueDownloadRecordFilesJob(
    workbookId: WorkbookId,
    actor: Actor,
    snapshotTableId: string,
    initialPublicProgress?: DownloadRecordFilesJobDefinition['publicProgress'],
  ): Promise<Job> {
    // Generate a simple ID without table names (since we can have 0, 1, or many tables)
    const id = `download-files-${actor.userId}-${workbookId}-${createPlainId()}`;
    const data: DownloadRecordFilesJobDefinition['data'] = {
      workbookId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      snapshotTableId,
      type: 'download-record-files',
      initialPublicProgress,
    };
    return await this.enqueueJobWithId(data, id);
  }

  async enqueueDownloadLinkedFolderFilesJob(
    workbookId: WorkbookId,
    actor: Actor,
    dataFolderId: DataFolderId,
    initialPublicProgress?: DownloadLinkedFolderFilesJobDefinition['publicProgress'],
  ): Promise<Job> {
    const id = `download-linked-folder-files-${actor.userId}-${workbookId}-${createPlainId()}`;
    const data: DownloadLinkedFolderFilesJobDefinition['data'] = {
      workbookId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      dataFolderId,
      type: 'download-linked-folder-files',
      initialPublicProgress,
    };
    return await this.enqueueJobWithId(data, id);
  }

  async enqueuePublishFilesJob(
    workbookId: WorkbookId,
    actor: Actor,
    snapshotTableIds?: string[],
    initialPublicProgress?: PublishFilesJobDefinition['publicProgress'],
  ): Promise<Job> {
    // Generate a simple ID without table names (since we can have 0, 1, or many tables)
    const id = `publish-files-${actor.userId}-${workbookId}-${createPlainId()}`;
    const data: PublishFilesJobDefinition['data'] = {
      workbookId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      snapshotTableIds,
      type: 'publish-files',
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
