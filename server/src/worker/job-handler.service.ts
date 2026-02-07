import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConnectorAccountService } from 'src/remote-service/connector-account/connector-account.service';
import { ConnectorsService } from 'src/remote-service/connectors/connectors.service';
import { SyncService } from 'src/sync/sync.service';
import { DataFolderPublishingService } from 'src/workbook/data-folder-publishing.service';
import { WorkbookEventService } from 'src/workbook/workbook-event.service';
import { BullEnqueuerService } from 'src/worker-enqueuer/bull-enqueuer.service';
import { ScratchpadConfigService } from '../config/scratchpad-config.service';
import { ScratchGitService } from '../scratch-git/scratch-git.service';
import { AddThreeNumbersJobHandler } from './jobs/job-definitions/add-three-numbers.job';
import { AddTwoNumbersJobHandler } from './jobs/job-definitions/add-two-numbers.job';
import { PublishDataFolderJobHandler } from './jobs/job-definitions/publish-data-folder.job';
import { PullLinkedFolderFilesJobHandler } from './jobs/job-definitions/pull-linked-folder-files.job';
import { SyncDataFoldersJobHandler } from './jobs/job-definitions/sync-data-folders.job';
import { JobData, JobDefinition, JobHandler } from './jobs/union-types';

@Injectable()
export class JobHandlerService {
  constructor(
    private readonly connectorService: ConnectorsService,
    private readonly config: ScratchpadConfigService,
    private readonly connectorAccountService: ConnectorAccountService,
    private readonly workbookEventService: WorkbookEventService,
    private readonly scratchGitService: ScratchGitService,
    private readonly dataFolderPublishingService: DataFolderPublishingService,
    private readonly syncService: SyncService,
    private readonly bullEnqueuerService: BullEnqueuerService,
  ) {}

  getHandler = (data: JobData): JobHandler<JobDefinition> => {
    const prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    });

    switch (data.type) {
      case 'add-two-numbers':
        return AddTwoNumbersJobHandler as JobHandler<JobDefinition>;
      case 'add-three-numbers':
        return new AddThreeNumbersJobHandler(prisma) as JobHandler<JobDefinition>;
      case 'pull-linked-folder-files':
        return new PullLinkedFolderFilesJobHandler(
          prisma,
          this.connectorService,
          this.connectorAccountService,
          this.workbookEventService,
          this.scratchGitService,
        ) as JobHandler<JobDefinition>;

      case 'publish-data-folder':
        return new PublishDataFolderJobHandler(
          prisma,
          this.connectorService,
          this.connectorAccountService,
          this.workbookEventService,
          this.dataFolderPublishingService,
          this.bullEnqueuerService,
        ) as JobHandler<JobDefinition>;

      case 'sync-data-folders':
        return new SyncDataFoldersJobHandler(prisma, this.syncService) as JobHandler<JobDefinition>;

      default:
        throw new Error(`Unknown job type. Data: ${JSON.stringify(data)}`);
    }
  };
}
