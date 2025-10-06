// export interface JobEntity {
//   id: string;
//   createdAt: string;
//   updatedAt: string;
//   userId: string;
//   status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
//   type: string;
//   data: Record<string, unknown>;
//   result?: Record<string, unknown> | null;
//   error?: string | null;
//   startedAt?: string | null;
//   completedAt?: string | null;
//   bullJobId?: string | null;
// }


export interface JobEntity<TPublicProgress = object> {
  bullJobId?: string | null;
  dbJobId?: string | null;
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused' | 'unknown' | 'canceled' | 'pending';
  type: string;
  progressTimestamp?: number;
  publicProgress?: TPublicProgress;
  processedOn?: Date | null;
  finishedOn?: Date | null;
  failedReason?: string | null;
}
// export interface JobEntity<TPublicProgress = object> {
//   jobId: string;
//   state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused' | 'unknown' | 'canceled' | 'pending';
//   progressTimestamp?: number;
//   publicProgress?: TPublicProgress;
//   processedOn?: number;
//   finishedOn?: number;
//   failedReason?: string;
// }
