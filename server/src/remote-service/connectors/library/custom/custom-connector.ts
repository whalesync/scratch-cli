/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { Service } from '@prisma/client';
import * as _ from 'lodash';
import { executeDeleteRecord, executePollRecords } from '../../../../api-import/function-executor';
import { DbService } from '../../../../db/db.service';
import { Connector } from '../../connector';
import { ConnectorRecord, EntityId, PostgresColumnType, TablePreview } from '../../types';
import { CustomTableSpec } from '../custom-spec-registry';

export class CustomConnector extends Connector<typeof Service.CUSTOM> {
  // TODO (ivan): fix this

  service = Service.CUSTOM;

  private readonly userId: string;
  private readonly db: DbService;
  constructor(
    userId: string,
    db: DbService,
    private apiKey: string,
  ) {
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
    const [tableId] = id.remoteId;
    const table = await this.db.client.genericTable.findUnique({
      where: { id: tableId },
      select: {
        id: true,
        name: true,
        mapping: true,
      },
    });

    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    const mapping = table.mapping as {
      recordArrayPath: string;
      idPath?: string;
      fields: Array<{
        path: string;
        type: string;
        name: string;
      }>;
    } | null;

    if (!mapping) {
      return {
        id,
        name: table.name,
        columns: [],
      };
    }

    // Convert the mapping to columns
    const columns = mapping.fields.map((field) => ({
      id: {
        wsId: field.name,
        remoteId: [field.name],
      },
      name: field.name,
      pgType: field.type as PostgresColumnType,
    }));

    return {
      id,
      name: table.name,
      columns,
    };
  }

  async downloadTableRecords(
    tableSpec: CustomTableSpec,
    callback: (records: ConnectorRecord[]) => Promise<void>,
  ): Promise<void> {
    const [tableId] = tableSpec.id.remoteId;

    // Get the table configuration from the database
    const table = await this.db.client.genericTable.findUnique({
      where: { id: tableId },
      select: {
        pollRecords: true,
        mapping: true,
      },
    });

    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    if (!table.pollRecords) {
      throw new Error('No poll records function configured for this table');
    }

    const mapping = table.mapping as {
      recordArrayPath: string;
      idPath?: string;
      fields: Array<{
        path: string;
        type: string;
        name: string;
      }>;
    } | null;

    if (!mapping) {
      throw new Error('Table configuration is incomplete');
    }

    // Execute the poll records function
    let data: unknown;
    try {
      // Use the standalone execution function
      data = await executePollRecords(table.pollRecords, this.apiKey);
    } catch (error) {
      console.error('Error executing poll records function:', error);
      throw error;
    }

    // Extract the array of records using the recordArrayPath
    let recordsArray: unknown[];
    if (mapping.recordArrayPath === '.') {
      recordsArray = Array.isArray(data) ? data : [];
    } else {
      const extractedData = _.get(data, mapping.recordArrayPath) as unknown;
      recordsArray = Array.isArray(extractedData) ? extractedData : [];
    }

    // Apply the mapping to transform records
    const mappedRecords: ConnectorRecord[] = recordsArray.map((record, index) => {
      const mappedFields: Record<string, unknown> = {};

      for (const field of mapping.fields) {
        if (field.path) {
          // Extract value from the source path using lodash
          const value = _.get(record, field.path) as unknown;
          mappedFields[field.name] = value;
        }
      }

      // Use the real ID if available, otherwise fall back to index
      let recordId: string;
      if (mapping.idPath) {
        const idValue = _.get(record, mapping.idPath) as unknown;
        recordId = String(idValue);
      } else {
        recordId = index.toString();
      }

      return {
        id: recordId,
        fields: mappedFields,
      };
    });

    // Call the callback with the mapped records
    await callback(mappedRecords);
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
    const [tableId] = tableSpec.id.remoteId;

    // Get the table configuration from the database
    const table = await this.db.client.genericTable.findUnique({
      where: { id: tableId },
      select: {
        deleteRecord: true,
      },
    });

    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    if (!table.deleteRecord) {
      throw new Error('No delete function configured for this table');
    }

    try {
      // Execute the delete function for each record
      for (const recordId of recordIds) {
        try {
          // Use the standalone execution function
          await executeDeleteRecord(table.deleteRecord, recordId.remoteId, this.apiKey);
          console.log(`Successfully deleted record: ${recordId.remoteId}`);
        } catch (error) {
          console.error(`Failed to delete record ${recordId.remoteId}:`, error);
          throw error;
        }
      }

      console.log(`Successfully processed delete operation for ${recordIds.length} records`);
    } catch (error) {
      console.error('Error executing dynamic delete function:', error);
      throw error;
    }
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
