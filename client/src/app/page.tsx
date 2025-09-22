'use client';

import { useSnapshots } from '@/hooks/use-snapshot';
import { Center, Loader, Stack, Text } from '@mantine/core';
import MainContent from './components/layouts/MainContent';
import { PageLayout } from './components/layouts/PageLayout';
import { SnapshotsList } from './snapshots/components/SnapshotList';

export default function HomePage() {
  const { snapshots, isLoading } = useSnapshots();

  let content = <></>;

  if (isLoading) {
    content = (
      <MainContent>
        <MainContent.Body>
          <Center h="100%">
            <Loader />
          </Center>
        </MainContent.Body>
      </MainContent>
    );
  } else if (snapshots && snapshots.length > 0) {
    content = <SnapshotsList />;
  } else {
    content = <GetStartedContent />;
  }

  return <PageLayout>{content}</PageLayout>;
}

const GetStartedContent = () => {
  return (
    <MainContent>
      <MainContent.BasicHeader title="Welcome to Scratchpaper.ai" />
      <MainContent.Body>
        <Center h="100%">
          <Stack>
            <Text>Welcome to Scratchpaper.ai</Text>
            <Text>Placeholder for the home page.</Text>
            <Text>TODO: add a video and some initial actions for the user to take</Text>
          </Stack>
        </Center>
      </MainContent.Body>
    </MainContent>
  );
};
