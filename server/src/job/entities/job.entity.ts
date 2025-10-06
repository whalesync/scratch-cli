import { DbJob } from '@prisma/client';
import { JobState } from 'bullmq';
import { Progress } from 'src/types/progress';
import { JsonSafeObject } from 'src/utils/objects';

export type DbJobStatus =
  | JobState
  | 'unknown'
  // bullmq state will be completed
  | 'canceled';
export interface JobEntity<TPublicProgress = JsonSafeObject> {
  bullJobId?: string | null;
  dbJobId?: string | null;
  state: DbJobStatus;
  type: string;
  progressTimestamp?: number;
  publicProgress?: TPublicProgress;
  processedOn?: Date | null;
  finishedOn?: Date | null;
  failedReason?: string | null;
}

export function dbJobToJobEntity(dbJob: DbJob): JobEntity {
  const progress = dbJob.progress as Progress;
  return {
    dbJobId: dbJob.id,
    bullJobId: dbJob.bullJobId,
    type: dbJob.type,
    state: dbJob.status as DbJobStatus,
    progressTimestamp: progress?.timestamp,
    publicProgress: progress?.publicProgress,
    processedOn: dbJob.processedOn,
    finishedOn: dbJob.finishedOn,
    failedReason: dbJob.error,
  };
}
