'use client';

import { PullProgressModal } from '@/app/components/jobs/pull/PullJobProgressModal';
import { PublishJobProgressModal } from '@/app/components/jobs/publish/PublishJobProgressModal';
import { IconButtonToolbar } from '@/app/components/base/buttons';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { Text12Regular, Text13Medium } from '@/app/components/base/text';
import { useJobs } from '@/hooks/use-jobs';
import { jobApi } from '@/lib/api/job';
import { JobEntity } from '@/types/server-entities/job';
import { timeAgo } from '@/utils/helpers';
import {
  Center,
  Group,
  JsonInput,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Table,
  Text,
  UnstyledButton,
} from '@mantine/core';
import type { WorkbookId } from '@spinner/shared-types';
import { AlertCircleIcon, ClockIcon, RefreshCwIcon } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type JobType = 'sync' | 'publish' | 'pull' | 'unknown';

const getJobType = (type: string): JobType => {
  if (type.includes('sync')) return 'sync';
  if (type.includes('publish')) return 'publish';
  if (type.includes('pull')) return 'pull';
  return 'unknown';
};

const getTypeLabel = (jobType: JobType): string => {
  switch (jobType) {
    case 'sync':
      return 'SYNC';
    case 'publish':
      return 'PUBLISH';
    case 'pull':
      return 'PULL';
    default:
      return 'JOB';
  }
};

const getTypeColor = (jobType: JobType): string => {
  switch (jobType) {
    case 'sync':
      return 'var(--mantine-color-yellow-5)';
    case 'publish':
      return 'var(--mantine-color-green-5)';
    case 'pull':
      return 'var(--mantine-color-cyan-5)';
    default:
      return 'var(--mantine-color-gray-5)';
  }
};

const getStatusColor = (status: JobEntity['state']): string => {
  switch (status) {
    case 'completed':
      return 'var(--mantine-color-green-6)';
    case 'failed':
      return 'var(--mantine-color-red-6)';
    case 'active':
      return 'var(--mantine-color-yellow-5)';
    case 'canceled':
      return 'var(--mantine-color-orange-5)';
    default:
      return 'var(--mantine-color-gray-5)';
  }
};

const getStatusLabel = (status: JobEntity['state']): string => {
  switch (status) {
    case 'completed':
      return 'Success';
    case 'failed':
      return 'Failed';
    case 'active':
      return 'Running';
    case 'canceled':
      return 'Canceled';
    case 'pending':
    case 'waiting':
    case 'delayed':
      return 'Pending';
    default:
      return status;
  }
};

const getJobDescription = (job: JobEntity): string => {
  const jobType = getJobType(job.type);
  const progress = (job.publicProgress && typeof job.publicProgress === 'object')
    ? job.publicProgress as Record<string, unknown>
    : null;

  switch (jobType) {
    case 'sync': {
      // Check for table count in progress
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
      if (progress?.totalFiles !== undefined) {
        const count = Number(progress.totalFiles) || 0;
        return `Discovered ${count} change${count !== 1 ? 's' : ''}`;
      }
      if (progress?.tables && Array.isArray(progress.tables)) {
        const count = progress.tables.length;
        return `Discovered ${count} table${count !== 1 ? 's' : ''}`;
      }
      return 'Pulled data';
    }
    default:
      return job.type;
  }
};

const formatDuration = (processedOn?: Date | null, finishedOn?: Date | null): string => {
  if (!processedOn) return '-';
  if (!finishedOn) return '-';

  const diff = new Date(finishedOn).getTime() - new Date(processedOn).getTime();
  const seconds = diff / 1000;

  if (seconds < 1) return `${Math.round(diff)}ms`;
  if (seconds < 60) return `${Math.round(seconds)}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
};

export function RunsView() {
  const params = useParams<{ id: string }>();
  const workbookId = params.id as WorkbookId;
  const { jobs, error, isLoading, mutate } = useJobs(50, 0, workbookId);
  const [selectedJob, setSelectedJob] = useState<JobEntity | null>(null);
  const [viewRawJobId, setViewRawJobId] = useState<string | null>(null);

  if (isLoading && jobs.length === 0) {
    return (
      <Center h="100%">
        <Group gap="sm">
          <Loader size="sm" />
          <Text c="dimmed">Loading runs...</Text>
        </Group>
      </Center>
    );
  }

  if (error) {
    return (
      <Center h="100%">
        <Stack align="center" gap="xs">
          <AlertCircleIcon size={24} color="var(--mantine-color-red-6)" />
          <Text c="red">Failed to load runs</Text>
        </Stack>
      </Center>
    );
  }

  if (jobs.length === 0) {
    return (
      <Center h="100%">
        <Stack align="center" gap="xs">
          <ClockIcon size={24} color="var(--mantine-color-gray-5)" />
          <Text c="dimmed">No runs yet</Text>
          <Text12Regular c="dimmed">Jobs will appear here when you run syncs or publish changes</Text12Regular>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack h="100%" gap={0}>
      {/* Header */}
      <Group
        h={48}
        px="md"
        justify="space-between"
        style={{
          borderBottom: '1px solid var(--fg-divider)',
          flexShrink: 0,
        }}
      >
        <Text13Medium>Recent Runs</Text13Medium>
        <Group gap="xs">
          <Text12Regular c="dimmed">{jobs.length} jobs</Text12Regular>
          <IconButtonToolbar onClick={() => mutate()} title="Refresh">
            <StyledLucideIcon Icon={RefreshCwIcon} size="sm" c="var(--fg-secondary)" />
          </IconButtonToolbar>
        </Group>
      </Group>

      {/* Table */}
      <ScrollArea style={{ flex: 1 }}>
        <Table>
          <Table.Tbody>
            {jobs.map((job) => {
              const jobType = getJobType(job.type);
              const typeColor = getTypeColor(jobType);
              const statusColor = getStatusColor(job.state);
              const description = getJobDescription(job);
              const duration = formatDuration(job.processedOn, job.finishedOn);
              const time = job.processedOn ? timeAgo(job.processedOn) : '-';
              const canViewResult = !!job.bullJobId;

              return (
                <Table.Tr key={`${job.dbJobId}-${job.bullJobId}`}>
                  {/* Type */}
                  <Table.Td style={{ width: 100 }}>
                    <Text size="sm" fw={600} style={{ color: typeColor }}>
                      {getTypeLabel(jobType)}
                    </Text>
                  </Table.Td>

                  {/* Description */}
                  <Table.Td>
                    <Text
                      size="sm"
                      style={{
                        maxWidth: 250,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {description}
                    </Text>
                  </Table.Td>

                  {/* Time */}
                  <Table.Td style={{ width: 120 }}>
                    <Text size="sm" c="dimmed">
                      {time}
                    </Text>
                  </Table.Td>

                  {/* Duration */}
                  <Table.Td style={{ width: 80 }}>
                    <Text size="sm" c="dimmed">
                      {duration}
                    </Text>
                  </Table.Td>

                  {/* Status (clickable) */}
                  <Table.Td style={{ width: 120 }}>
                    <UnstyledButton
                      onClick={() => canViewResult && setSelectedJob(job)}
                      style={{
                        cursor: canViewResult ? 'pointer' : 'default',
                        opacity: canViewResult ? 1 : 0.7,
                      }}
                    >
                      <Group gap={6} wrap="nowrap">
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: statusColor,
                            flexShrink: 0,
                          }}
                        />
                        <Text
                          size="sm"
                          style={{
                            color: statusColor,
                            textDecoration: canViewResult ? 'underline' : 'none',
                            textDecorationStyle: 'dotted',
                            textUnderlineOffset: 2,
                          }}
                        >
                          {getStatusLabel(job.state)}
                        </Text>
                      </Group>
                    </UnstyledButton>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      {/* Job Progress Modal */}
      {selectedJob && selectedJob.bullJobId && (
        <>
          {selectedJob.type === 'publish-records' ? (
            <PublishJobProgressModal jobId={selectedJob.bullJobId} onClose={() => setSelectedJob(null)} />
          ) : (
            <PullProgressModal jobId={selectedJob.bullJobId} onClose={() => setSelectedJob(null)} />
          )}
        </>
      )}

      {/* Raw JSON Modal */}
      <JobRawModal jobId={viewRawJobId} onClose={() => setViewRawJobId(null)} />
    </Stack>
  );
}

function JobRawModal({ jobId, onClose }: { jobId: string | null; onClose: () => void }) {
  const [data, setData] = useState<object | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (jobId) {
      setLoading(true);
      jobApi
        .getJobRaw(jobId)
        .then(setData)
        .catch((err) => {
          console.debug(err);
          setData({ error: 'Failed to fetch' });
        })
        .finally(() => setLoading(false));
    } else {
      setData(null);
    }
  }, [jobId]);

  return (
    <Modal opened={!!jobId} onClose={onClose} title="Raw Job Data" size="xl">
      {loading ? (
        <Center p="xl">
          <Loader />
        </Center>
      ) : (
        <JsonInput value={JSON.stringify(data, null, 2)} formatOnBlur autosize minRows={10} readOnly />
      )}
    </Modal>
  );
}
