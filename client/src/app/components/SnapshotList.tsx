'use client';

import { useSnapshots } from '@/hooks/use-snapshot';
import { RouteUrls } from '@/utils/route-urls';
import { Center, Loader, SimpleGrid } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { ContentContainer } from './ContentContainer';
import { ErrorInfo, Info } from './InfoPanel';
import { SnapshotCard } from './SnapshotCard';
import { PrimaryButton } from './base/buttons';

export const SnapshotsList = () => {
  const { snapshots, isLoading, error } = useSnapshots();
  const router = useRouter();

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
    <ContentContainer title="Snapshots">
      <SimpleGrid cols={1} spacing="md" maw="1000px">
        {snapshots && snapshots.length > 0 ? (
          snapshots.map((snapshot) => <SnapshotCard key={snapshot.id} snapshot={snapshot} />)
        ) : (
          <Info>
            <Info.NotFoundIcon />
            <Info.Title> No syncs could be found</Info.Title>
            <Info.Actions>
              <PrimaryButton onClick={() => router.push(RouteUrls.connectionsPageUrl)} variant="outline" size="sm">
                Create a snapshot (TODO)
              </PrimaryButton>
            </Info.Actions>
          </Info>
        )}
      </SimpleGrid>
    </ContentContainer>
  );
};
