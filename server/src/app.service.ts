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
        title:
          'How to connect Google Sheets and Airtable in 5 Minutes (2-way sync tutorial)',
      },
      staged: undefined,
      suggested: undefined,
    },
    {
      id: '3',
      remote: {
        title:
          'Create an Airtable to HubSpot integration in 10 minutes with Whalesync',
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

    // If the new title is the same as the remote title, set to undefined.
    if (data.title === record.remote.title) {
      if (stage) {
        record.staged = undefined;
      } else {
        record.suggested = undefined;
      }
    } else {
      // Otherwise, update the title.
      if (stage) {
        record.staged = { title: data.title };
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
}
