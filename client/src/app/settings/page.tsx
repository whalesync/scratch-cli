'use client';

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
          <DebugInfo />
        </Stack>
        <AgentUsageInfoCard />
      </Group>
    </ContentContainer>
  );
};

export default SettingsPage;
