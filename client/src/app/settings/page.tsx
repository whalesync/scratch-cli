'use client';

import { useDevTools } from '@/hooks/use-dev-tools';
import { Stack } from '@mantine/core';
import MainContent from '../components/layouts/MainContent';
import { AgentCredentials } from './components/AgentCredentials';
import { AgentUsageInfoCard } from './components/AgentUsageInfoCard';
import { DevToolsPanel } from './components/DevToolPanel';
import { SubscriptionCard } from './components/SubscriptionCard';

const SettingsPage = () => {
  const { isDevToolsEnabled } = useDevTools();

  return (
    <MainContent>
      <MainContent.BasicHeader title="Settings" />
      <MainContent.Body>
        <Stack gap={0} miw={800}>
          <SubscriptionCard />
          <AgentCredentials />
          <AgentUsageInfoCard />
          {isDevToolsEnabled && <DevToolsPanel />}
        </Stack>
      </MainContent.Body>
    </MainContent>
  );
};

export default SettingsPage;
