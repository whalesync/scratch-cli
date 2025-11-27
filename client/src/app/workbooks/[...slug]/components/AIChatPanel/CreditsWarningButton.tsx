import { Text12Regular, Text13Regular } from '@/app/components/base/text';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { AiAgentCredential } from '@/types/server-entities/agent-credentials';
import { RouteUrls } from '@/utils/route-urls';
import { ActionIcon, Popover, Stack } from '@mantine/core';
import { CircleAlert } from 'lucide-react';
import Link from 'next/link';

export const CreditsWarningButton = ({ credential }: { credential: AiAgentCredential }) => {
  if (!credential.usage) {
    console.debug('No usage data for credential', credential.id);
    return null;
  }

  return (
    <Popover width="auto">
      <Popover.Target>
        <ActionIcon variant="transparent-hover" title="Credits Warning">
          <StyledLucideIcon Icon={CircleAlert} size={12} c="red" />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Text13Regular c="var(--fg-secondary)">
            Your active OpenRouter key ({credential.label}) is approaching its credit limit.
          </Text13Regular>

          <Text12Regular c="dimmed">
            {`$${Number(Math.max(credential.usage.usage, 0.01)).toFixed(2)} used out of ${credential.usage.limit === 0 ? 'unlimited' : '$' + credential.usage.limit} limit`}{' '}
            {credential.usage.limitReset && `(${credential.usage.limitReset})`}
          </Text12Regular>
          <Text13Regular c="var(--fg-secondary)">
            You can switch credentials by going to the <Link href={RouteUrls.settingsPageUrl}>Settings</Link> page.
          </Text13Regular>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
};
