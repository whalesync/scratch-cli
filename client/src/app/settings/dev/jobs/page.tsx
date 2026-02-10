'use client';

import { PullProgressModal } from '@/app/components/jobs/pull/PullJobProgressModal';
import { PublishJobProgressModal } from '@/app/components/jobs/publish/PublishJobProgressModal';
import MainContent from '@/app/components/layouts/MainContent';
import { useJobs } from '@/hooks/use-jobs';
import { jobApi } from '@/lib/api/job';
import { JobEntity } from '@/types/server-entities/job';
import { formatDate, timeAgo } from '@/utils/helpers';
import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Group,
  JsonInput,
  Loader,
  Modal,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { BriefcaseIcon, Check, Circle, Code, Dot, Eye, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const getStatusIcon = (status: JobEntity['state']) => {
  switch (status) {
    case 'pending':
      return (
        <ThemeIcon size="sm" variant="outline" color="gray">
          <Circle size={12} />
        </ThemeIcon>
      );
    case 'active':
      return (
        <ThemeIcon size="sm" color="blue">
          <Dot size={12} />
        </ThemeIcon>
      );
    case 'completed':
      return (
        <ThemeIcon size="sm" color="green">
          <Check size={12} />
        </ThemeIcon>
      );
    case 'failed':
    case 'canceled':
      return (
        <ThemeIcon size="sm" color="red">
          <X size={12} />
        </ThemeIcon>
      );
    default:
      return (
        <ThemeIcon size="sm" variant="outline" color="gray">
          <Circle size={12} />
        </ThemeIcon>
      );
  }
};

const getStatusColor = (status: JobEntity['state']) => {
  switch (status) {
    case 'pending':
      return 'gray';
    case 'active':
      return 'blue';
    case 'completed':
      return 'green';
    case 'failed':
      return 'red';
    case 'canceled':
      return 'orange';
    default:
      return 'gray';
  }
};

export default function JobsDevPage() {
  const { jobs, error, isLoading } = useJobs();
  const [selectedJob, setSelectedJob] = useState<JobEntity | null>(null);
  const [viewRawJobId, setViewRawJobId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <MainContent>
        <MainContent.BasicHeader title="Jobs" Icon={BriefcaseIcon} />
        <MainContent.Body>
          <Center h="100%">
            <Group>
              <Loader size="sm" />
              <Text>Loading jobs...</Text>
            </Group>
          </Center>
        </MainContent.Body>
      </MainContent>
    );
  }

  if (error) {
    return (
      <MainContent>
        <MainContent.BasicHeader title="Jobs" Icon={BriefcaseIcon} />
        <MainContent.Body>
          <Center h="100%">
            <Text c="red">Error loading jobs: {error.message}</Text>
          </Center>
        </MainContent.Body>
      </MainContent>
    );
  }

  return (
    <MainContent>
      <MainContent.BasicHeader title="Jobs" Icon={BriefcaseIcon} />
      <MainContent.Body>
        {jobs.length === 0 ? (
          <Center h="50vh">
            <Text c="dimmed">No jobs found</Text>
          </Center>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Job ID</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Started</Table.Th>
                <Table.Th>Duration</Table.Th>
                <Table.Th>Completed</Table.Th>
                <Table.Th>Error</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {jobs.map((job) => {
                let duration: string | null = null;
                if (job.processedOn && job.finishedOn) {
                  const diff = new Date(job.finishedOn).getTime() - new Date(job.processedOn).getTime();
                  const seconds = diff / 1000;
                  duration = seconds >= 10 ? `${Math.floor(seconds)}s` : `${seconds.toFixed(3)}s`;
                }

                return (
                  <Table.Tr key={`${job.dbJobId}-${job.bullJobId}`}>
                    <Table.Td>
                      <Stack>
                        <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
                          {job.dbJobId || '-'}
                        </Text>
                        <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
                          {job.bullJobId || '-'}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        {getStatusIcon(job.state)}
                        <Badge color={getStatusColor(job.state)} size="sm">
                          {job.state}
                        </Badge>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{job.type}</Text>
                    </Table.Td>
                    <Table.Td>
                      {job.processedOn ? (
                        <Tooltip label={formatDate(job.processedOn)}>
                          <Text size="sm" c="dimmed">
                            {timeAgo(job.processedOn)}
                          </Text>
                        </Tooltip>
                      ) : (
                        '-'
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed" style={{ fontFamily: 'monospace' }}>
                        {duration || '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {job.finishedOn ? (
                        <Tooltip label={formatDate(job.finishedOn)}>
                          <Text size="sm" c="dimmed">
                            {timeAgo(job.finishedOn)}
                          </Text>
                        </Tooltip>
                      ) : (
                        '-'
                      )}
                    </Table.Td>
                    <Table.Td>
                      {job.failedReason ? (
                        <Text size="sm" c="red" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {job.failedReason}
                        </Text>
                      ) : (
                        '-'
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <Tooltip label="View Raw JSON">
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            onClick={() => setViewRawJobId(job.bullJobId || job.dbJobId || null)}
                          >
                            <Code size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Button
                          size="xs"
                          variant="outline"
                          leftSection={<Eye size={14} />}
                          onClick={() => setSelectedJob(job)}
                          disabled={!job.bullJobId}
                        >
                          View Result
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </MainContent.Body>

      {selectedJob && selectedJob.bullJobId && (
        <>
          {selectedJob.type === 'publish-records' ? (
            <PublishJobProgressModal jobId={selectedJob.bullJobId} onClose={() => setSelectedJob(null)} />
          ) : (
            <PullProgressModal jobId={selectedJob.bullJobId} onClose={() => setSelectedJob(null)} />
          )}
        </>
      )}

      <JobRawModal jobId={viewRawJobId} onClose={() => setViewRawJobId(null)} />
    </MainContent>
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
          console.error(err);
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
