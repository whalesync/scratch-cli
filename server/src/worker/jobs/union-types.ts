import { Job as BullMQPlainJob } from 'bullmq';
import { Progress } from './base-types';
import { AddThreeNumbersJobDefinition } from './job-definitions/add-three-numbers.job';
import { AddTwoNumbersJobDefinition } from './job-definitions/add-two-numbers.job';
import { DownloadFilesJobDefinition } from './job-definitions/download-files.job';
import { DownloadLinkedFolderFilesJobDefinition } from './job-definitions/download-linked-folder-files.job';
import { DownloadRecordFilesJobDefinition } from './job-definitions/download-record-files.job';
import { PublishFilesJobDefinition } from './job-definitions/publish-files.job';
import { SyncDataFoldersJobDefinition } from './job-definitions/sync-data-folders.job';

export type JobDefinition =
  | AddTwoNumbersJobDefinition
  | AddThreeNumbersJobDefinition
  | DownloadFilesJobDefinition
  | DownloadRecordFilesJobDefinition
  | DownloadLinkedFolderFilesJobDefinition
  | PublishFilesJobDefinition
  | SyncDataFoldersJobDefinition;
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
