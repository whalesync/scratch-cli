import { Injectable } from '@nestjs/common';
import { Service } from '@prisma/client';
import { CsvFileService } from 'src/csv-file/csv-file.service';
import { SnapshotCluster } from 'src/db/cluster-types';
import { ConnectorAccountId } from 'src/types/ids';
import { ConnectorAccountService } from '../remote-service/connector-account/connector-account.service';
import { SnapshotService } from '../snapshot/snapshot.service';
import { CreateContentSnapshotDto } from './dto/create-content-snapshot.dto';

const CONTENT_FILE_BODY = `id,name,content_md,status
1,Sample Item,This is some test content,unpublished`;

@Injectable()
export class ContentToolsService {
  constructor(
    private readonly connectorAccountService: ConnectorAccountService,
    private readonly snapshotService: SnapshotService,
    private readonly csvFileService: CsvFileService,
  ) {}

  async createContentSnapshot(createDto: CreateContentSnapshotDto, userId: string): Promise<SnapshotCluster.Snapshot> {
    // create the CSV file

    const csvFile = await this.csvFileService.create(
      {
        name: createDto.name,
        body: CONTENT_FILE_BODY,
      },
      userId,
    );

    // create the CSV connector account if it doesn't exist
    const connectorAccounts = await this.connectorAccountService.findAll(userId);
    let csvConnectorAccount = connectorAccounts.find((ca) => ca.service === Service.CSV);
    if (!csvConnectorAccount) {
      csvConnectorAccount = await this.connectorAccountService.create(
        {
          service: Service.CSV,
          apiKey: '',
        },
        userId,
      );
    }

    // create the snapshot from the connector account
    const snapshot = await this.snapshotService.create(
      {
        connectorAccountId: csvConnectorAccount.id as ConnectorAccountId,
        name: `${createDto.name} Content`,
        tableIds: [{ wsId: csvFile.id, remoteId: [csvFile.id] }],
      },
      userId,
    );

    // return the snapshot
    return snapshot;
  }
}
