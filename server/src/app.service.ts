import { Injectable } from '@nestjs/common';
import { RecordsGateway } from './records.gateway';

interface Record {
  id: string;
  remote: { title: string };
  staged: { title: string } | null | undefined;
  suggested: { title: string } | null | undefined;
}

@Injectable()
export class AppService {
  constructor(private readonly recordsGateway: RecordsGateway) {}

  private records: Record[] = [
    {
      id: '1',
      remote: { title: 'Create a HubSpot to Notion integration in 1 min' },
      staged: undefined,
      suggested: undefined,
    },
    {
      id: '2',
      remote: {
        title: 'How to connect Google Sheets and Airtable in 5 Minutes (2-way sync tutorial)',
      },
      staged: undefined,
      suggested: undefined,
    },
    {
      id: '3',
      remote: {
        title: 'Create an Airtable to HubSpot integration in 10 minutes with Whalesync',
      },
      staged: undefined,
      suggested: undefined,
    },
  ];

  getRecords(): Record[] {
    return this.records;
  }

  updateRecord(id: string, stage: boolean, data: { title: string }): Record {
    const index = this.records.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error(`Record with id ${id} not found`);
    }

    const record = this.records[index];

    if (stage) {
      // If the new staged title is the same as the remote, set staged to undefined.
      if (data.title === record.remote.title) {
        record.staged = undefined;
      } else {
        record.staged = { title: data.title };
      }
      // If the new staged title matches the suggestion, clear the suggestion.
      if (record.suggested && data.title === record.suggested.title) {
        record.suggested = undefined;
      }
    } else {
      // This is a suggestion update
      if (data.title === record.remote.title) {
        record.suggested = undefined;
      } else {
        record.suggested = { title: data.title };
      }
    }

    // Notify clients about the update
    this.recordsGateway.notifyRecordUpdate(this.records);

    return this.records[index];
  }

  createRecord(record: { title: string }): Record {
    const newId = (this.records.length + 1).toString();
    const newRecord: Record = {
      id: newId,
      remote: { title: record.title },
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
    // Filter out records marked for deletion and update the ones that have a staged title
    const updatedRecords = this.records
      .filter((record) => record.staged !== null) // Remove records where staged is marked for deletion
      .map((record) => {
        if (record.staged && record.staged.title) {
          // If there is a staged title, update the remote title
          record.remote.title = record.staged.title;
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
