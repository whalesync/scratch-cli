import { JobEntity } from '@/types/server-entities/job';

export type JobType = 'sync' | 'publish' | 'pull' | 'unknown';

export const getJobType = (type: string): JobType => {
  if (type.includes('sync')) return 'sync';
  if (type.includes('publish')) return 'publish';
  if (type.includes('pull')) return 'pull';
  return 'unknown';
};

export const getTypeLabel = (jobType: JobType): string => {
  switch (jobType) {
    case 'sync':
      return 'Sync';
    case 'publish':
      return 'Publish';
    case 'pull':
      return 'Pull';
    default:
      return 'JOB';
  }
};

export const getJobDescription = (job: JobEntity): string => {
  const jobType = getJobType(job.type);
  const progress =
    job.publicProgress && typeof job.publicProgress === 'object'
      ? (job.publicProgress as Record<string, unknown>)
      : null;

  switch (jobType) {
    case 'sync': {
      if (progress?.tables && Array.isArray(progress.tables)) {
        const count = progress.tables.length;
        return `Synced ${count} table${count !== 1 ? 's' : ''}`;
      }
      if (progress?.syncName) {
        return `Synced ${progress.syncName}`;
      }
      return 'Synced';
    }
    case 'publish': {
      if (progress?.totalFiles !== undefined) {
        const count = Number(progress.totalFiles) || 0;
        return `Published ${count} change${count !== 1 ? 's' : ''}`;
      }
      return 'Published changes';
    }
    case 'pull': {
      const folderSuffix = progress?.folderName ? ` for ${progress.folderName}` : '';
      if (progress?.totalFiles !== undefined) {
        const count = Number(progress.totalFiles) || 0;
        return `Refreshed ${count} file${count !== 1 ? 's' : ''}${folderSuffix}`;
      }
      return 'Refreshed data';
    }
    default:
      return job.type;
  }
};
