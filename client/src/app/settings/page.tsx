'use client';

import { useDevTools } from '@/hooks/use-dev-tools';
import { Button, Stack, Tooltip } from '@mantine/core';
import MainContent from '../components/layouts/MainContent';
import { AgentCredentials } from './components/AgentCredentials';
import { AgentUsageInfoCard } from './components/AgentUsageInfoCard';
import { DevToolsPanel } from './components/DevToolPanel';
import { UserPreferencesCard } from './components/UserPreferencesCard';

const SettingsPage = () => {
  const { isDevToolsEnabled, showSecretButton, toggleDevToolsVisible } = useDevTools();

  return (
    <MainContent>
      <MainContent.BasicHeader title="Settings" />
      <MainContent.Body>
        <Stack gap={0} miw={800}>
          <UserPreferencesCard />
          <AgentCredentials />
          <AgentUsageInfoCard />

          {isDevToolsEnabled && <DevToolsPanel />}
          {showSecretButton && (
            <Tooltip label={isDevToolsEnabled ? 'Hide dev tools' : 'Show dev tools'}>
              <Button
                size="xs"
                variant="transparent"
                onClick={() => {
                  toggleDevToolsVisible();
                  window.location.reload();
                }}
                w="fit-content"
                color="white"
              >
                Toggle dev tools
              </Button>
            </Tooltip>
          )}
        </Stack>
      </MainContent.Body>
    </MainContent>
  );
};

export default SettingsPage;
