import { Injectable } from '@nestjs/common';
import { ConnectorAccount, Service } from '@prisma/client';
import { CsvFileService } from '../../csv-file/csv-file.service';
import { DbService } from '../../db/db.service';
import { Connector } from './connector';
import { AirtableConnector } from './library/airtable/airtable-connector';
import { CsvConnector } from './library/csv/csv-connector';
import { CustomConnector } from './library/custom/custom-connector';
import { NotionConnector } from './library/notion/notion-connector';

@Injectable()
export class ConnectorsService {
  constructor(
    private readonly db: DbService,
    private readonly csvFileService: CsvFileService,
  ) {}

  getConnector(account: ConnectorAccount): Connector<Service> {
    switch (account.service) {
      case Service.AIRTABLE:
        return new AirtableConnector(account.apiKey);
      case Service.NOTION:
        return new NotionConnector(account.apiKey);
      case Service.CUSTOM:
        return new CustomConnector(account.userId, this.db, account.apiKey);
      case Service.CSV:
        return new CsvConnector(this.csvFileService);
      default:
        throw new Error(`Unsupported service: ${account.service as string}`);
    }
  }
}
