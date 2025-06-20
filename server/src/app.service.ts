import { Injectable } from '@nestjs/common';
import { RecordsGateway } from './records.gateway';

interface DataRecord {
  id: string;
  remote: Record<string, unknown>;
  staged: Record<string, unknown> | null | undefined;
  suggested: Record<string, unknown> | null | undefined;
}

@Injectable()
export class AppService {
  constructor(private readonly recordsGateway: RecordsGateway) {}

  private records: DataRecord[] = [
    {
      id: '1',
      remote: {
        title: 'Create a HubSpot to Notion integration in 1 min',
        description:
          'Learn how to quickly set up data sync between HubSpot and Notion using our platform',
      },
      staged: undefined,
      suggested: undefined,
    },
    {
      id: '2',
      remote: {
        title:
          'How to connect Google Sheets and Airtable in 5 Minutes (2-way sync tutorial)',
        description:
          'Step-by-step guide to create bidirectional data synchronization between Google Sheets and Airtable',
      },
      staged: undefined,
      suggested: undefined,
    },
    {
      id: '3',
      remote: {
        title:
          'Create an Airtable to HubSpot integration in 10 minutes with Whalesync',
        description:
          'Complete tutorial for building a custom integration between Airtable and HubSpot using our sync platform',
      },
      staged: undefined,
      suggested: undefined,
    },
  ];

  getRecords(): DataRecord[] {
    return this.records;
  }

  updateRecord(
    id: string,
    stage: boolean,
    data: Record<string, unknown>,
  ): DataRecord {
    const index = this.records.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error(`Record with id ${id} not found`);
    }

    const record = this.records[index];

    if (stage) {
      // If the new staged data is the same as the remote, set staged to undefined.
      if (JSON.stringify(data) === JSON.stringify(record.remote)) {
        record.staged = undefined;
      } else {
        record.staged = data;
      }
      // If the new staged data matches the suggestion, clear the suggestion.
      if (
        record.suggested &&
        JSON.stringify(data) === JSON.stringify(record.suggested)
      ) {
        record.suggested = undefined;
      }
    } else {
      // This is a suggestion update
      if (JSON.stringify(data) === JSON.stringify(record.remote)) {
        record.suggested = undefined;
      } else {
        record.suggested = data;
      }
    }

    // Notify clients about the update
    this.recordsGateway.notifyRecordUpdate(this.records);

    return this.records[index];
  }

  createRecord(record: Record<string, unknown>): DataRecord {
    const newId = (this.records.length + 1).toString();
    const newRecord: DataRecord = {
      id: newId,
      remote: record,
      staged: undefined,
      suggested: undefined,
    };
    this.records.push(newRecord);

    // Notify clients about the update
    this.recordsGateway.notifyRecordUpdate(this.records);

    return newRecord;
  }

  deleteRecord(id: string, stage: boolean): void {
    const index = this.records.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error(`Record with id ${id} not found`);
    }

    if (stage) {
      this.records[index].staged = null;
    } else {
      this.records[index].suggested = null;
    }

    // Notify clients about the update
    this.recordsGateway.notifyRecordUpdate(this.records);
  }

  pushChanges(): void {
    // Filter out records marked for deletion and update the ones that have staged data
    const updatedRecords = this.records
      .filter((record) => record.staged !== null) // Remove records where staged is marked for deletion
      .map((record) => {
        if (record.staged) {
          // If there is staged data, update the remote data
          record.remote = { ...record.staged };
        }
        // Reset staged and suggested for all remaining records
        record.staged = undefined;
        record.suggested = undefined;
        return record;
      });

    this.records = updatedRecords;

    // Notify clients about the update
    this.recordsGateway.notifyRecordUpdate(this.records);
  }
}
