import { Injectable } from '@nestjs/common';
import { Snapshot } from '@prisma/client';
import { Observable, Subject } from 'rxjs';
import { AnyTableSpec } from 'src/remote-service/connectors/library/custom-spec-registry';

export interface SnapshotRecordEvent {
  type: 'record-changes';
  data: {
    id: string;
    numRecords: number;
    changeType: 'suggested' | 'accepted';
    source?: string; // where the changes are coming from (e.g. ai-agent, user.)
  };
}

export interface SnapshotEvent {
  type: 'snapshot-updated' | 'snapshot-deleted';
  data: {
    id: string;
    name: string;
  };
}

@Injectable()
export class SnapshotEventService {
  private recordEventSubjects: Record<string, Subject<SnapshotRecordEvent>> = {};
  private snapshotEventSubjects: Record<string, Subject<SnapshotEvent>> = {};

  constructor() {}

  getRecordEvents(snapshot: Snapshot, tableSpec: AnyTableSpec): Observable<SnapshotRecordEvent> {
    const key = this.createKey('records', snapshot.id, tableSpec.id.wsId);
    // see if there is a subject registered for this snapshotId
    if (!this.recordEventSubjects[key]) {
      this.recordEventSubjects[key] = new Subject<SnapshotRecordEvent>();
    }
    return this.recordEventSubjects[key].asObservable();
  }

  getSnapshotEvents(snapshot: Snapshot): Observable<SnapshotEvent> {
    const key = this.createKey('snapshot', snapshot.id);
    if (!this.snapshotEventSubjects[key]) {
      this.snapshotEventSubjects[key] = new Subject<SnapshotEvent>();
    }
    return this.snapshotEventSubjects[key].asObservable();
  }

  sendRecordEvent(snapshot: string, tableId: string, event: SnapshotRecordEvent) {
    const key = this.createKey('records', snapshot, tableId);
    if (!this.recordEventSubjects[key]) {
      return;
    }
    this.recordEventSubjects[key].next(event);
  }

  sendSnapshotEvent(snapshotId: string, event: SnapshotEvent) {
    const key = this.createKey('snapshot', snapshotId);
    if (!this.snapshotEventSubjects[key]) {
      return;
    }
    this.snapshotEventSubjects[key].next(event);
  }

  private createKey(prefix: string, snapshotId: string, tableId?: string) {
    return `${prefix}-${snapshotId}${tableId ? `-${tableId}` : ''}`;
  }
}
