export interface SnapshotRecordEventPayload {
      numRecords: number;
      changeType: 'suggested' | 'accepted';
      source: "user" | "agent";
  }
  
  export interface SnapshotEventPayload {
      tableId?: string;
      source: "user" | "agent";
  }
  