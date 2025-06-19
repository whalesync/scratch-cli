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
    this.recordsGateway.notifyRecordUpdate();

    return this.records[index];
  }

  createRecord(record: Omit<Record, 'id'>): Record {
    const newId = (this.records.length + 1).toString();
    const newRecord = { ...record, id: newId };
    this.records.push(newRecord);

    // Notify clients about the update
    this.recordsGateway.notifyRecordUpdate();

    return newRecord;
  }

  deleteRecord(id: string): void {
    const index = this.records.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error(`Record with id ${id} not found`);
    }
    this.records.splice(index, 1);

    // Notify clients about the update
    this.recordsGateway.notifyRecordUpdate();
  }
}
