'use client';

import { useDevTools } from '@/hooks/use-dev-tools';
import { Divider, Group, Stack } from '@mantine/core';
import MainContent from '../components/MainContent';
import { AgentCredentials } from './components/AgentCredentials';
import { AgentUsageInfoCard } from './components/AgentUsageInfoCard';
import { DevToolsPanel } from './components/DebugInfo';
import { SubscriptionCard } from './components/SubscriptionCard';

const SettingsPage = () => {
  const { isDevToolsEnabled } = useDevTools();

  return (
    <MainContent>
      <MainContent.BasicHeader title="Settings" />
      <MainContent.Body>
        <Group gap="md" align="flex-start" grow>
          <Stack gap="md" miw={800}>
            <SubscriptionCard />
            <Divider />
            <AgentCredentials />
            <Divider />
            <AgentUsageInfoCard />
          </Stack>
          {isDevToolsEnabled && (
            <Stack gap="md" maw={600} ml="auto">
              <DevToolsPanel />
            </Stack>
          )}
        </Group>
      </MainContent.Body>
    </MainContent>
  );
};

export default SettingsPage;
