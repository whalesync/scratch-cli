'use client';

import { Badge, Button, Center, Group, Loader, Table, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { Check, Circle, Dot, Eye, X } from 'lucide-react';
import { useState } from 'react';
import { useJobs } from '../../../hooks/use-jobs';
import { JobEntity } from '../../../types/server-entities/job';
import { formatDate, timeAgo } from '../../../utils/helpers';
import { DownloadProgressModal2 } from '../../components/jobs/download/DownloadJobProgressModal2';
import MainContent from '../../components/layouts/MainContent';

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

// const formatJobType = (type: JobEntity['type']) => {
//   switch (type) {
//     case 'DOWNLOAD_RECORDS':
//       return 'Download Records';
//     case 'ADD_TWO_NUMBERS':
//       return 'Add Two Numbers';
//     case 'ADD_THREE_NUMBERS':
//       return 'Add Three Numbers';
//     default:
//       return type;
//   }
// };

export default function JobsPage() {
  const { jobs, error, isLoading } = useJobs();
  const [selectedJob, setSelectedJob] = useState<JobEntity | null>(null);

  if (isLoading) {
    return (
      <MainContent>
        <MainContent.BasicHeader title="Jobs" />
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
        <MainContent.BasicHeader title="Jobs" />
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
      <MainContent.BasicHeader title="Jobs" />
      <MainContent.Body>
        {jobs.length === 0 ? (
          <Center h="50vh">
            <Text c="dimmed">No jobs found</Text>
          </Center>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Status</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Started</Table.Th>
                <Table.Th>Completed</Table.Th>
                <Table.Th>Error</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {jobs.map((job) => (
                <Table.Tr key={`${job.dbJobId}-${job.bullJobId}`}>
                  <Table.Td>
                    <Group gap="xs">
                      {/* {JSON.stringify(job)} */}
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
                    <Button
                      size="xs"
                      variant="outline"
                      leftSection={<Eye size={14} />}
                      onClick={() => setSelectedJob(job)}
                      disabled={!job.bullJobId}
                    >
                      View Result
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </MainContent.Body>

      {/* Download Progress Modal */}
      {selectedJob && selectedJob.bullJobId && (
        <DownloadProgressModal2 job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}
    </MainContent>
  );
}
