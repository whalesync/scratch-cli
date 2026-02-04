import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConnectorAccountService } from 'src/remote-service/connector-account/connector-account.service';
import { ConnectorsService } from 'src/remote-service/connectors/connectors.service';
import { SyncService } from 'src/sync/sync.service';
import { OnboardingService } from 'src/users/onboarding.service';
import { FilePublishingService } from 'src/workbook/file-publishing.service';
import { SnapshotEventService } from 'src/workbook/snapshot-event.service';
import { WorkbookDbService } from 'src/workbook/workbook-db.service';
import { WorkbookService } from 'src/workbook/workbook.service';
import { ScratchpadConfigService } from '../config/scratchpad-config.service';
import { ScratchGitService } from '../scratch-git/scratch-git.service';
import { AddThreeNumbersJobHandler } from './jobs/job-definitions/add-three-numbers.job';
import { AddTwoNumbersJobHandler } from './jobs/job-definitions/add-two-numbers.job';
import { DownloadFilesJobHandler } from './jobs/job-definitions/download-files.job';
import { DownloadLinkedFolderFilesJobHandler } from './jobs/job-definitions/download-linked-folder-files.job';
import { DownloadRecordFilesJobHandler } from './jobs/job-definitions/download-record-files.job';
import { PublishFilesJobHandler } from './jobs/job-definitions/publish-files.job';
import { SyncDataFoldersJobHandler } from './jobs/job-definitions/sync-data-folders.job';
import { JobData, JobDefinition, JobHandler } from './jobs/union-types';

@Injectable()
export class JobHandlerService {
  constructor(
    private readonly connectorService: ConnectorsService,
    private readonly workbookDbService: WorkbookDbService,
    private readonly config: ScratchpadConfigService,
    private readonly connectorAccountService: ConnectorAccountService,
    private readonly snapshotEventService: SnapshotEventService,
    private readonly workbookService: WorkbookService,
    private readonly onboardingService: OnboardingService,
    private readonly filePublishingService: FilePublishingService,
    private readonly scratchGitService: ScratchGitService,
    private readonly syncService: SyncService,
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
      case 'download-files':
        return new DownloadFilesJobHandler(
          prisma,
          this.connectorService,
          this.workbookDbService.workbookDb,
          this.connectorAccountService,
          this.snapshotEventService,
          this.scratchGitService,
        ) as JobHandler<JobDefinition>;
      case 'download-record-files':
        return new DownloadRecordFilesJobHandler(
          prisma,
          this.connectorService,
          this.workbookDbService.workbookDb,
          this.connectorAccountService,
          this.snapshotEventService,
          this.scratchGitService,
        ) as JobHandler<JobDefinition>;
      case 'download-linked-folder-files':
        return new DownloadLinkedFolderFilesJobHandler(
          prisma,
          this.connectorService,
          this.workbookDbService.workbookDb,
          this.connectorAccountService,
          this.snapshotEventService,
          this.scratchGitService,
        ) as JobHandler<JobDefinition>;

      case 'publish-files':
        return new PublishFilesJobHandler(
          prisma,
          this.connectorService,
          this.connectorAccountService,
          this.snapshotEventService,
          this.filePublishingService,
          this.onboardingService,
        ) as JobHandler<JobDefinition>;

      case 'sync-data-folders':
        return new SyncDataFoldersJobHandler(prisma, this.syncService) as JobHandler<JobDefinition>;

      default:
        throw new Error(`Unknown job type. Data: ${JSON.stringify(data)}`);
    }
  };
}
