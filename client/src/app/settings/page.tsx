'use client';

import { useDevTools } from '@/hooks/use-dev-tools';
import { Divider, Group, Stack } from '@mantine/core';
import { ContentContainer } from '../components/ContentContainer';
import { AgentCredentials } from './components/AgentCredentials';
import { AgentUsageInfoCard } from './components/AgentUsageInfoCard';
import { DevToolsPanel } from './components/DebugInfo';
import { SubscriptionCard } from './components/SubscriptionCard';

const SettingsPage = () => {
  const { isDevToolsEnabled } = useDevTools();

  return (
    <ContentContainer title="Settings">
      <Group gap="md" align="flex-start">
        <Stack gap="md">
          <SubscriptionCard />
          <AgentCredentials />
        </Stack>
        <AgentUsageInfoCard />
      </Group>

      {isDevToolsEnabled && (
        <>
          <Divider my="md" />
          <Stack gap="md" maw={700}>
            <DevToolsPanel />
          </Stack>
        </>
      )}
    </ContentContainer>
  );
};

export default SettingsPage;
