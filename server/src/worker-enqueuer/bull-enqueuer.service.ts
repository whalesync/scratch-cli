import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createPlainId, DataFolderId, SyncId, WorkbookId } from '@spinner/shared-types';
import { Job, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { Actor } from 'src/users/types';
import { PullFilesJobDefinition } from 'src/worker/jobs/job-definitions/pull-files.job';
import { JobData } from 'src/worker/jobs/union-types';
import { PublishDataFolderJobDefinition } from '../worker/jobs/job-definitions/publish-data-folder.job';
import { PullLinkedFolderFilesJobDefinition } from '../worker/jobs/job-definitions/pull-linked-folder-files.job';
import { PullRecordFilesJobDefinition } from '../worker/jobs/job-definitions/pull-record-files.job';
import { SyncDataFoldersJobDefinition } from '../worker/jobs/job-definitions/sync-data-folders.job';

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

  async enqueuePullFilesJob(
    workbookId: WorkbookId,
    actor: Actor,
    snapshotTableIds?: string[],
    initialPublicProgress?: PullFilesJobDefinition['publicProgress'],
  ): Promise<Job> {
    // Generate a simple ID without table names (since we can have 0, 1, or many tables)
    const id = `pull-files-${actor.userId}-${workbookId}-${createPlainId()}`;
    const data: PullFilesJobDefinition['data'] = {
      workbookId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      snapshotTableIds,
      type: 'pull-files',
      initialPublicProgress,
    };
    return await this.enqueueJobWithId(data, id);
  }

  async enqueuePullRecordFilesJob(
    workbookId: WorkbookId,
    actor: Actor,
    snapshotTableId: string,
    initialPublicProgress?: PullRecordFilesJobDefinition['publicProgress'],
  ): Promise<Job> {
    // Generate a simple ID without table names (since we can have 0, 1, or many tables)
    const id = `pull-files-${actor.userId}-${workbookId}-${createPlainId()}`;
    const data: PullRecordFilesJobDefinition['data'] = {
      workbookId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      snapshotTableId,
      type: 'pull-record-files',
      initialPublicProgress,
    };
    return await this.enqueueJobWithId(data, id);
  }

  async enqueuePullLinkedFolderFilesJob(
    workbookId: WorkbookId,
    actor: Actor,
    dataFolderId: DataFolderId,
    initialPublicProgress?: PullLinkedFolderFilesJobDefinition['publicProgress'],
  ): Promise<Job> {
    const id = `pull-linked-folder-files-${actor.userId}-${workbookId}-${createPlainId()}`;
    const data: PullLinkedFolderFilesJobDefinition['data'] = {
      workbookId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      dataFolderId,
      type: 'pull-linked-folder-files',
      initialPublicProgress,
    };
    return await this.enqueueJobWithId(data, id);
  }

  async enqueuePublishDataFolderJob(
    workbookId: WorkbookId,
    actor: Actor,
    dataFolderIds: DataFolderId[],
    initialPublicProgress?: PublishDataFolderJobDefinition['publicProgress'],
  ): Promise<Job> {
    const id = `publish-data-folder-${actor.userId}-${workbookId}-${createPlainId()}`;
    const data: PublishDataFolderJobDefinition['data'] = {
      workbookId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      dataFolderIds,
      type: 'publish-data-folder',
      initialPublicProgress,
    };
    return await this.enqueueJobWithId(data, id);
  }

  async enqueueSyncDataFoldersJob(
    workbookId: WorkbookId,
    syncId: SyncId,
    actor: Actor,
    initialPublicProgress?: SyncDataFoldersJobDefinition['publicProgress'],
  ): Promise<Job> {
    const id = `sync-data-folders-${actor.userId}-${workbookId}-${createPlainId()}`;
    const data: SyncDataFoldersJobDefinition['data'] = {
      workbookId,
      syncId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      type: 'sync-data-folders',
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
