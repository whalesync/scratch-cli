import { Injectable } from '@nestjs/common';
import { RecordsGateway } from './records.gateway';

interface Record {
  id: string;
  title: string;
}

@Injectable()
export class AppService {
  constructor(private readonly recordsGateway: RecordsGateway) {}

  private records: Record[] = [
    { id: '1', title: ' Create a HubSpot to Notion integration in 1 min' },
    {
      id: '2',
      title:
        'How to connect Google Sheets and Airtable in 5 Minutes (2-way sync tutorial)',
    },
    {
      id: '3',
      title:
        'Create an Airtable to HubSpot integration in 10 minutes with Whalesync',
    },
  ];

  getRecords(): Record[] {
    return this.records;
  }

  updateRecord(id: string, record: Record): Record {
    const index = this.records.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error(`Record with id ${id} not found`);
    }
    this.records[index] = { ...record, id };

    // Notify clients about the update
    this.recordsGateway.notifyRecordUpdate(this.records);

    return this.records[index];
  }

  updateRecordsBatch(updates: { id: string; title: string }[]): Record[] {
    const updatedRecords = updates.map((update) => {
      const index = this.records.findIndex((r) => r.id === update.id);
      if (index === -1) {
        throw new Error(`Record with id ${update.id} not found`);
      }
      this.records[index] = { ...this.records[index], title: update.title };
      return this.records[index];
    });

    // Notify clients about the updates
    this.recordsGateway.notifyRecordUpdate(this.records);

    return updatedRecords;
  }

  createRecord(record: Omit<Record, 'id'>): Record {
    const newId = (this.records.length + 1).toString();
    const newRecord = { ...record, id: newId };
    this.records.push(newRecord);

    // Notify clients about the update
    this.recordsGateway.notifyRecordUpdate(this.records);

    return newRecord;
  }

  createRecordsBatch(records: Omit<Record, 'id'>[]): Record[] {
    const newRecords = records.map((record, index) => {
      const newId = (this.records.length + index + 1).toString();
      return { ...record, id: newId };
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
      throw new Error('No records were deleted. Some IDs might not exist.');
    }

    // Notify clients about the updates
    this.recordsGateway.notifyRecordUpdate(this.records);
  }
}
