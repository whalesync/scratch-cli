'use client';

import { useDevTools } from '@/hooks/use-dev-tools';
import { Button, Divider, Stack, Tooltip } from '@mantine/core';
import { SettingsIcon } from 'lucide-react';
import MainContent from '../components/layouts/MainContent';
import { AgentCredentialsSection } from './components/AgentCredentialsSection';
import { DefaultModelSection } from './components/DefaultModelSection';
import { TokenUsageSection } from './components/TokenUsageSection';
import { UserDevToolsSection } from './components/UserDevToolsSection';

const SettingsPage = () => {
  const { isDevToolsEnabled, showSecretButton, toggleDevToolsVisible } = useDevTools();

  return (
    <MainContent>
      <MainContent.BasicHeader title="Settings" Icon={SettingsIcon} />
      <MainContent.Body>
        <Stack gap="20px" maw={800}>
          <DefaultModelSection />
          <Divider c="var(--mantine-color-gray-3)" />
          <AgentCredentialsSection />
          <Divider c="var(--mantine-color-gray-3)" />
          <TokenUsageSection />

          {isDevToolsEnabled && (
            <>
              <Divider c="var(--mantine-color-gray-3)" />
              <UserDevToolsSection />
            </>
          )}
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
