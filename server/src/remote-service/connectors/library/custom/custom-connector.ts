import { Service } from '@prisma/client';
import * as _ from 'lodash';
import {
  executeCreateRecord,
  executeDeleteRecord,
  executePollRecords,
  executeSchema,
  executeUpdateRecord,
} from '../../../../api-import/function-executor';
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
        fetchSchema: true,
      },
    });

    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    // If we have a fetch schema function, call it to get the schema
    if (table.fetchSchema) {
      try {
        const schemaData = await executeSchema(table.fetchSchema, this.apiKey);

        // Check if the data is in the expected schema format
        if (Array.isArray(schemaData)) {
          const columns = schemaData
            .map((schemaField: unknown) => {
              if (
                typeof schemaField === 'object' &&
                schemaField !== null &&
                'id' in schemaField &&
                'displayName' in schemaField &&
                'type' in schemaField
              ) {
                const field = schemaField as { id: string; displayName: string; type: string };
                return {
                  id: {
                    wsId: field.id,
                    remoteId: [field.id],
                  },
                  name: field.displayName,
                  pgType: field.type as PostgresColumnType,
                };
              }
              return null;
            })
            .filter((col): col is NonNullable<typeof col> => col !== null);

          return {
            id,
            name: table.name,
            columns,
          };
        }
      } catch (error) {
        console.error('Error fetching table spec from schema function:', error);
        // Fall back to empty columns
      }
    }

    // Fall back to empty columns if no schema function or error
    return {
      id,
      name: table.name,
      columns: [],
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
      },
    });

    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    if (!table.pollRecords) {
      throw new Error('No poll records function configured for this table');
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

    // Check if the data is in the new standardized format
    if (
      Array.isArray(data) &&
      data.length > 0 &&
      typeof data[0] === 'object' &&
      data[0] !== null &&
      'id' in data[0] &&
      'fields' in data[0]
    ) {
      // Handle standardized format: { id: string, fields: { [fieldId]: value } }
      const standardizedRecords = data as Array<{ id: string; fields: Record<string, string> }>;

      // Convert to ConnectorRecord format
      const connectorRecords: ConnectorRecord[] = standardizedRecords.map((record) => ({
        id: record.id,
        fields: record.fields,
      }));

      // Call the callback with the standardized records
      await callback(connectorRecords);
    } else {
      // Handle legacy format - use tableSpec columns to map the data
      const recordsArray = Array.isArray(data) ? data : [];

      const mappedRecords: ConnectorRecord[] = recordsArray.map((record, index) => {
        const mappedFields: Record<string, unknown> = {};

        // Use tableSpec columns to map the data
        for (const column of tableSpec.columns) {
          const fieldId = column.id.wsId;
          const value = _.get(record, fieldId) as unknown;
          mappedFields[fieldId] = value;
        }

        // Use the record's ID if available, otherwise fall back to index
        let recordId: string;
        if (typeof record === 'object' && record !== null && 'id' in record) {
          const recordWithId = record as { id: unknown };
          recordId = String(recordWithId.id);
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
  }

  getBatchSize(): number {
    return 10;
  }

  async createRecords(
    tableSpec: CustomTableSpec,
    records: { wsId: string; fields: Record<string, unknown> }[],
  ): Promise<{ wsId: string; remoteId: string }[]> {
    const [tableId] = tableSpec.id.remoteId;

    // Get the table configuration from the database
    const table = await this.db.client.genericTable.findUnique({
      where: { id: tableId },
      select: {
        createRecord: true,
      },
    });

    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    if (!table.createRecord) {
      throw new Error('No create function configured for this table');
    }

    const results: { wsId: string; remoteId: string }[] = [];

    try {
      // Execute the create function for each record
      for (const record of records) {
        try {
          // Use the standalone execution function
          const result = await executeCreateRecord(table.createRecord, record.fields, this.apiKey);
          console.log(`Successfully created record: ${record.wsId}`);

          // Extract the created record ID from the result
          let remoteId: string;
          if (typeof result === 'object' && result !== null && 'id' in result) {
            remoteId = String((result as { id: unknown }).id);
          } else if (typeof result === 'string') {
            remoteId = result;
          } else {
            // Fallback to wsId if no ID in response
            remoteId = record.wsId;
          }

          results.push({
            wsId: record.wsId,
            remoteId,
          });
        } catch (error) {
          console.error(`Failed to create record ${record.wsId}:`, error);
          throw error instanceof Error ? error : new Error(String(error));
        }
      }

      console.log(`Successfully processed create operation for ${records.length} records`);
      return results;
    } catch (error) {
      console.error('Error executing dynamic create function:', error);
      throw error;
    }
  }

  async updateRecords(
    tableSpec: CustomTableSpec,
    records: {
      id: { wsId: string; remoteId: string };
      partialFields: Record<string, unknown>;
    }[],
  ): Promise<void> {
    const [tableId] = tableSpec.id.remoteId;

    // Get the table configuration from the database
    const table = await this.db.client.genericTable.findUnique({
      where: { id: tableId },
      select: {
        updateRecord: true,
      },
    });

    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    if (!table.updateRecord) {
      throw new Error('No update function configured for this table');
    }

    try {
      // Execute the update function for each record
      for (const record of records) {
        try {
          // Use the standalone execution function
          await executeUpdateRecord(table.updateRecord, record.id.remoteId, record.partialFields, this.apiKey);
          console.log(`Successfully updated record: ${record.id.remoteId}`);
        } catch (error) {
          console.error(`Failed to update record ${record.id.remoteId}:`, error);
          throw error instanceof Error ? error : new Error(String(error));
        }
      }

      console.log(`Successfully processed update operation for ${records.length} records`);
    } catch (error) {
      console.error('Error executing dynamic update function:', error);
      throw error;
    }
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
