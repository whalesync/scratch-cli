import { JobStatus } from '@prisma/client';
import { JobState } from 'bullmq';
import { JsonSafeObject } from 'src/utils/objects';

export class JobEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  status: JobStatus;
  type: string;
  data: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  error?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  bullJobId?: string | null;
}

export interface JobProgressEntity<TPublicProgress = JsonSafeObject> {
  jobId: string;
  state: JobState | 'unknown';
  progressTimestamp?: number;
  publicProgress?: TPublicProgress;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
}

export { JobStatus };
