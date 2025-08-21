'use client';

import { UserProfile } from '@clerk/nextjs';
import { Group, Stack } from '@mantine/core';
import { ContentContainer } from '../components/ContentContainer';
import { AgentCredentials } from './components/AgentCredentials';
import { AgentUsageInfoCard } from './components/AgentUsageInfoCard';
import { DebugInfo } from './components/DebugInfo';

const SettingsPage = () => {
  return (
    <ContentContainer title="Settings">
      <Group gap="md" align="flex-start">
        <Stack gap="md">
          <AgentCredentials />
          <AgentUsageInfoCard />
          <DebugInfo />
        </Stack>
        <UserProfile routing="hash" />
      </Group>
    </ContentContainer>
  );
};

export default SettingsPage;
