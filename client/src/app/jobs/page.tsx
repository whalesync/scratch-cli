'use client';

import { Badge, Center, Group, Loader, Table, Text, ThemeIcon } from '@mantine/core';
import { Check, Circle, Dot, X } from 'lucide-react';
import { useJobs } from '../../hooks/use-jobs';
import { JobEntity } from '../../types/server-entities/job';
import MainContent from '../components/layouts/MainContent';

const getStatusIcon = (status: JobEntity['status']) => {
  switch (status) {
    case 'PENDING':
      return (
        <ThemeIcon size="sm" variant="outline" color="gray">
          <Circle size={12} />
        </ThemeIcon>
      );
    case 'ACTIVE':
      return (
        <ThemeIcon size="sm" color="blue">
          <Dot size={12} />
        </ThemeIcon>
      );
    case 'COMPLETED':
      return (
        <ThemeIcon size="sm" color="green">
          <Check size={12} />
        </ThemeIcon>
      );
    case 'FAILED':
    case 'CANCELLED':
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

const getStatusColor = (status: JobEntity['status']) => {
  switch (status) {
    case 'PENDING':
      return 'gray';
    case 'ACTIVE':
      return 'blue';
    case 'COMPLETED':
      return 'green';
    case 'FAILED':
      return 'red';
    case 'CANCELLED':
      return 'orange';
    default:
      return 'gray';
  }
};

const formatJobType = (type: JobEntity['type']) => {
  switch (type) {
    case 'DOWNLOAD_RECORDS':
      return 'Download Records';
    case 'ADD_TWO_NUMBERS':
      return 'Add Two Numbers';
    case 'ADD_THREE_NUMBERS':
      return 'Add Three Numbers';
    default:
      return type;
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString();
};

export default function JobsPage() {
  const { jobs, error, isLoading } = useJobs();

  if (isLoading) {
    return (
      <MainContent>
        <MainContent.BasicHeader title="Jobs" />
        <MainContent.Body p="0">
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
        <MainContent.Body p="0">
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
      <MainContent.Body p="0">
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
                <Table.Th>Created</Table.Th>
                <Table.Th>Started</Table.Th>
                <Table.Th>Completed</Table.Th>
                <Table.Th>Error</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {jobs.map((job) => (
                <Table.Tr key={job.id}>
                  <Table.Td>
                    <Group gap="xs">
                      {getStatusIcon(job.status)}
                      <Badge color={getStatusColor(job.status)} size="sm">
                        {job.status}
                      </Badge>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{formatJobType(job.type)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{formatDate(job.createdAt)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{job.startedAt ? formatDate(job.startedAt) : '-'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{job.completedAt ? formatDate(job.completedAt) : '-'}</Text>
                  </Table.Td>
                  <Table.Td>
                    {job.error ? (
                      <Text size="sm" c="red" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {job.error}
                      </Text>
                    ) : (
                      '-'
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </MainContent.Body>
    </MainContent>
  );
}
