/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Service } from '@prisma/client';
import { DbService } from '../../../../db/db.service';
import { Connector } from '../../connector';
import { ConnectorRecord, EntityId, TablePreview } from '../../types';
import { CustomTableSpec } from '../custom-spec-registry';

export class CustomConnector extends Connector<typeof Service.CUSTOM> {
  // TODO (ivan): fix this
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  service = Service.CUSTOM;

  private readonly userId: string;
  private readonly db: DbService;
  constructor(userId: string, db: DbService) {
    super();
    this.userId = userId;
    this.db = db;
  }

  public async testConnection(): Promise<void> {
    // Don't throw.
  }

  async listTables(): Promise<TablePreview[]> {
    const tables = await this.db.client.genericTable.findMany({
      where: { userId: this.userId },
      select: {
        id: true,
        name: true,
      },
    });

    return tables.map((table) => ({
      id: {
        wsId: table.id,
        remoteId: [table.id],
      },
      displayName: table.name,
    }));
  }

  async fetchTableSpec(id: EntityId): Promise<CustomTableSpec> {
    const [baseId, tableId] = id.remoteId;
    const tables = await this.db.client.genericTable.findMany({
      where: { userId: this.userId },
      select: {
        id: true,
        name: true,
        mapping: true,
      },
    });
    return {
      id,
      name: '',
      columns: [],
    };
  }

  async downloadTableRecords(
    tableSpec: CustomTableSpec,
    callback: (records: ConnectorRecord[]) => Promise<void>,
  ): Promise<void> {
    return;
  }

  getBatchSize(): number {
    return 10;
  }

  async createRecords(
    tableSpec: CustomTableSpec,
    records: { wsId: string; fields: Record<string, unknown> }[],
  ): Promise<{ wsId: string; remoteId: string }[]> {
    return [];
  }

  async updateRecords(
    tableSpec: CustomTableSpec,
    records: {
      id: { wsId: string; remoteId: string };
      partialFields: Record<string, unknown>;
    }[],
  ): Promise<void> {
    // const [baseId, tableId] = tableSpec.id.remoteId;
    // const airtableRecords = records.map((r) => {
    //   return {
    //     id: r.id.remoteId,
    //     fields: this.wsFieldsToAirtableFields(r.partialFields, tableSpec),
    //   };
    // });
    // await this.client.updateRecords(baseId, tableId, airtableRecords);
  }

  async deleteRecords(tableSpec: CustomTableSpec, recordIds: { wsId: string; remoteId: string }[]): Promise<void> {
    const [baseId, tableId] = tableSpec.id.remoteId;
    return;
  }

  // Record fields need to be keyed by the remoteId, not the wsId.
  // private wsFieldsToAirtableFields(
  //   wsFields: Record<string, unknown>,
  //   tableSpec: CustomTableSpec,
  // ): Record<string, unknown> {
  //   const airtableFields: Record<string, unknown> = {};
  //   for (const column of tableSpec.columns) {
  //     if (column.id.wsId === 'id') {
  //       continue;
  //     }
  //     const val = wsFields[column.id.wsId];
  //     if (val !== undefined) {
  //       if (column.pgType === PostgresColumnType.NUMERIC) {
  //         airtableFields[column.id.remoteId[0]] = parseFloat(val as string);
  //       } else {
  //         airtableFields[column.id.remoteId[0]] = val;
  //       }
  //     }
  //   }
  //   return airtableFields;
  // }
}
