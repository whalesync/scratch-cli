import { Job as BullMQPlainJob } from 'bullmq';
import { Progress } from './base-types';
import { AddThreeNumbersJobDefinition } from './job-definitions/add-three-numbers.job';
import { AddTwoNumbersJobDefinition } from './job-definitions/add-two-numbers.job';
import { DownloadRecordsJobDefinition } from './job-definitions/download-records.job';
import { PublishRecordsJobDefinition } from './job-definitions/publish-records.job';

export type JobDefinition =
  | AddTwoNumbersJobDefinition
  | AddThreeNumbersJobDefinition
  | DownloadRecordsJobDefinition
  | PublishRecordsJobDefinition;
export type JobData = JobDefinition['data'];
export type JobTypes = JobDefinition['type'];
export type BullMqJob<TDefinition extends JobDefinition = JobDefinition> = BullMQPlainJob<
  TDefinition['data'],
  TDefinition['result'],
  TDefinition['type']
>;
export type JobHandler<TDefinition extends JobDefinition> = {
  run: (params: {
    data: TDefinition['data'];
    progress: Progress<TDefinition['publicProgress'], TDefinition['initialJobProgress']>;
    abortSignal: AbortSignal;
    checkpoint: (
      progress: Omit<Progress<TDefinition['publicProgress'], TDefinition['initialJobProgress']>, 'timestamp'>,
    ) => Promise<void>;
  }) => Promise<TDefinition['result']>;
  terminate?: (params: {
    reason: 'canceled' | 'termina-failure';
    data: TDefinition['data'];
    progress: Progress<TDefinition['publicProgress']>;
  }) => Promise<TDefinition['result']>;
};
