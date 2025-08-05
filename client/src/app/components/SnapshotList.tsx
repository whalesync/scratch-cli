'use client';

import { useSnapshots } from '@/hooks/use-snapshot';
import { Center, Loader, SimpleGrid, Text } from '@mantine/core';
import { ContentContainer } from './ContentContainer';
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
    return (
      <Center h="100%">
        <Text c="red">{error}</Text>
      </Center>
    );
  }

  return (
    <ContentContainer title="Snapshots">
      <SimpleGrid cols={1} spacing="md" maw="600px">
        {snapshots && snapshots.length > 0 ? (
          snapshots.map((snapshot) => <SnapshotCard key={snapshot.id} snapshot={snapshot} />)
        ) : (
          <Text c="dimmed" style={{ textAlign: 'center' }}>
            No snapshots found.
          </Text>
        )}
      </SimpleGrid>
    </ContentContainer>
  );
};
