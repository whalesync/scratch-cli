'use client';

import { UserProfile } from '@clerk/nextjs';
import { Group, Stack } from '@mantine/core';
import { ContentContainer } from '../components/ContentContainer';
import { AgentCredentials } from './components/AgentCredentials';
import { DebugInfo } from './components/DebugInfo';

const SettingsPage = () => {
  return (
    <ContentContainer title="Settings">
      <Group gap="md" align="flex-start">
        <UserProfile routing="hash" />
        <Stack gap="md">
          <DebugInfo />
          <AgentCredentials />
        </Stack>
      </Group>
    </ContentContainer>
  );
};

export default SettingsPage;
