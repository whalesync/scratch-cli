'use client';

import MainContent from '@/app/components/layouts/MainContent';
import { useSnapshots } from '@/hooks/use-snapshot';
import { Center, Loader, SimpleGrid, Stack } from '@mantine/core';
import { ErrorInfo } from '../../components/InfoPanel';
import { CreateSnapshotPanel } from './CreateSnapshotPanel';
import { SnapshotCard } from './SnapshotCard';

export const SnapshotsList = () => {
  const { snapshots, isLoading, error } = useSnapshots();

  if (isLoading) {
    return (
      <Center h="100%">
        <Loader />
      </Center>
    );
  }

  if (error) {
    return <ErrorInfo error={error} title="Error loading snapshots" />;
  }

  return (
    <MainContent>
      <MainContent.BasicHeader title="Scratchpapers" />
      <MainContent.Body>
        <Stack gap="md">
          {snapshots && snapshots.length > 0 ? (
            <SimpleGrid cols={1} spacing="md" maw="1000px">
              {snapshots.map((snapshot) => (
                <SnapshotCard key={snapshot.id} snapshot={snapshot} />
              ))}
            </SimpleGrid>
          ) : null}
          <CreateSnapshotPanel />
        </Stack>
      </MainContent.Body>
    </MainContent>
  );
};
