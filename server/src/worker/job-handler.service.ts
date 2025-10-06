import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConnectorsService } from 'src/remote-service/connectors/connectors.service';
import { SnapshotDbService } from 'src/snapshot/snapshot-db.service';
import { ScratchpadConfigService } from '../config/scratchpad-config.service';
import { AddThreeNumbersJobHandler } from './jobs/job-definitions/add-three-numbers.job';
import { AddTwoNumbersJobHandler } from './jobs/job-definitions/add-two-numbers.job';
import { DownloadRecordsJobHandler } from './jobs/job-definitions/download-records.job';
import { JobDefinition, JobHandler } from './jobs/union-types';

@Injectable()
export class JobHandlerService {
  constructor(
    private readonly connectorService: ConnectorsService,
    private readonly snapshotDbService: SnapshotDbService,
    private readonly config: ScratchpadConfigService,
  ) {}

  getHandler = <TDefinition extends JobDefinition>(data: TDefinition['data']): JobHandler<TDefinition> => {
    const prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    });

    switch (data.type) {
      case 'add-two-numbers':
        return AddTwoNumbersJobHandler;
      case 'add-three-numbers':
        return new AddThreeNumbersJobHandler(prisma);
      case 'download-records':
        return new DownloadRecordsJobHandler(prisma, this.connectorService, this.snapshotDbService.snapshotDb);

      default:
        throw new Error(`Unknown job type. Data: ${JSON.stringify(data)}`);
    }
  };
}
