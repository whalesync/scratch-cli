'use client';

import { ButtonPrimarySolid } from '@/app/components/base/buttons';
import { ConfigSection } from '@/app/components/ConfigSection';
import MainContent from '@/app/components/layouts/MainContent';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { usersApi } from '@/lib/api/users';
import { ActionIcon, CopyButton, Group, PasswordInput, Stack, Tooltip } from '@mantine/core';
import { CheckIcon, CopyIcon, KeyIcon, RefreshCwIcon } from 'lucide-react';
import { useState } from 'react';

export default function ApiKeySettingsPage() {
  const { user, refreshCurrentUser } = useScratchPadUser();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateToken = async () => {
    if (user?.apiToken) {
      const confirmed = window.confirm(
        'This will invalidate your existing API key. Any integrations using it will stop working. Continue?',
      );
      if (!confirmed) return;
    }

    setIsGenerating(true);
    try {
      await usersApi.generateApiToken();
      await refreshCurrentUser();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <MainContent>
      <MainContent.BasicHeader title="API Key" Icon={KeyIcon} />
      <MainContent.Body>
        <Stack gap="20px" maw={800}>
          <ConfigSection title="API Key" description="Use this key to authenticate with the Scratch API.">
            {user?.apiToken ? (
              <Group wrap="nowrap" gap="xs">
                <PasswordInput variant="unstyled" value={user.apiToken} placeholder="No API key" readOnly flex={1} />
                <CopyButton value={user.apiToken} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? 'Copied' : 'Copy API key'} withArrow position="right">
                      <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                        {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
                <Tooltip label="Regenerate API key">
                  <ActionIcon variant="subtle" color="gray" onClick={handleGenerateToken} loading={isGenerating}>
                    <RefreshCwIcon size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            ) : (
              <ButtonPrimarySolid
                size="xs"
                leftSection={<KeyIcon size={16} />}
                onClick={handleGenerateToken}
                loading={isGenerating}
              >
                Generate API Key
              </ButtonPrimarySolid>
            )}
          </ConfigSection>
        </Stack>
      </MainContent.Body>
    </MainContent>
  );
}
