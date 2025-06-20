import { Injectable } from '@nestjs/common';
import { RecordsGateway } from './records.gateway';

interface Record {
  id: string;
  remote: { title: string };
  staged: { title: string };
  suggested: { title: string | null };
}

@Injectable()
export class AppService {
  constructor(private readonly recordsGateway: RecordsGateway) {}

  private records: Record[] = [
    {
      id: '1',
      remote: { title: 'Create a HubSpot to Notion integration in 1 min' },
      staged: { title: 'Create a HubSpot to Notion integration in 1 min' },
      suggested: { title: null },
    },
    {
      id: '2',
      remote: {
        title:
          'How to connect Google Sheets and Airtable in 5 Minutes (2-way sync tutorial)',
      },
      staged: {
        title:
          'How to connect Google Sheets and Airtable in 5 Minutes (2-way sync tutorial)',
      },
      suggested: { title: null },
    },
    {
      id: '3',
      remote: {
        title:
          'Create an Airtable to HubSpot integration in 10 minutes with Whalesync',
      },
      staged: {
        title:
          'Create an Airtable to HubSpot integration in 10 minutes with Whalesync',
      },
      suggested: { title: null },
    },
  ];

  getRecords(): Record[] {
    return this.records;
  }

  updateRecord(id: string, staged: boolean, data: { title: string }): Record {
    const index = this.records.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error(`Record with id ${id} not found`);
    }

    if (staged) {
      this.records[index].staged.title = data.title;
      this.records[index].suggested.title = null;
    } else {
      this.records[index].suggested.title = data.title;
    }

    // Notify clients about the update
    this.recordsGateway.notifyRecordUpdate(this.records);

    return this.records[index];
  }

  // Keeping batch updates simple for now, assuming they are always staged
  updateRecordsBatch(updates: { id: string; title: string }[]): Record[] {
    const updatedRecords = updates.map((update) => {
      const index = this.records.findIndex((r) => r.id === update.id);
      if (index === -1) {
        throw new Error(`Record with id ${update.id} not found`);
      }
      this.records[index].staged.title = update.title;
      this.records[index].suggested.title = null;
      return this.records[index];
    });

    // Notify clients about the updates
    this.recordsGateway.notifyRecordUpdate(this.records);

    return updatedRecords;
  }

  createRecord(record: { title: string }): Record {
    const newId = (this.records.length + 1).toString();
    const newRecord: Record = {
      id: newId,
      remote: { title: record.title },
      staged: { title: record.title },
      suggested: { title: null },
    };
    this.records.push(newRecord);

    // Notify clients about the update
    this.recordsGateway.notifyRecordUpdate(this.records);

    return newRecord;
  }

  createRecordsBatch(records: { title: string }[]): Record[] {
    const newRecords: Record[] = records.map((record, index) => {
      const newId = (this.records.length + index + 1).toString();
      return {
        id: newId,
        remote: { title: record.title },
        staged: { title: record.title },
        suggested: { title: null },
      };
    });

    this.records.push(...newRecords);

    // Notify clients about the updates
    this.recordsGateway.notifyRecordUpdate(this.records);

    return newRecords;
  }

  deleteRecord(id: string): void {
    const index = this.records.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error(`Record with id ${id} not found`);
    }
    this.records.splice(index, 1);

    // Notify clients about the update
    this.recordsGateway.notifyRecordUpdate(this.records);
  }

  deleteRecordsBatch(ids: string[]): void {
    const initialLength = this.records.length;
    this.records = this.records.filter((record) => !ids.includes(record.id));

    if (this.records.length === initialLength) {
      // This might not be an error worth throwing, maybe just a warning.
      // For now, I'll keep it as is.
      throw new Error('No records were deleted. Some IDs might not exist.');
    }

    // Notify clients about the updates
    this.recordsGateway.notifyRecordUpdate(this.records);
  }
}
