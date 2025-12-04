import { Text12Regular } from '@/app/components/base/text';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { isOverCreditLimit } from '@/hooks/use-agent-credentials';
import { Box, Group, Progress, Stack, Tooltip } from '@mantine/core';
import { AgentCredential } from '@spinner/shared-types';
import { InfoIcon } from 'lucide-react';

export const CredentialLimit = ({
  credential,
  includeLimitReset = true,
}: {
  credential: AgentCredential;
  includeLimitReset?: boolean;
}) => {
  if (!credential.usage) {
    return null;
  }

  // limit is 0 for unlimited, set arbitrary high max for the progress bar
  const max = credential.usage.limit === 0 ? 10000 : credential.usage.limit;
  const value = credential.usage.usage === 0 ? 0 : (credential.usage.usage / max) * 100;

  let resetPhrase = '';

  if (includeLimitReset && credential.usage.limitReset) {
    if (credential.usage.limitReset === 'daily') {
      resetPhrase = ' today';
    } else if (credential.usage.limitReset === 'weekly') {
      resetPhrase = ' this week';
    } else if (credential.usage.limitReset === 'monthly') {
      resetPhrase = ' this month';
    }
  }

  return (
    <Stack gap="6px">
      <Progress value={value} color={isOverCreditLimit(credential) ? 'red.6' : 'green.6'} />
      <Group gap="xs" align="center">
        <Text12Regular c="dimmed">
          {`$${Number(Math.max(credential.usage.usage, 0.0)).toFixed(2)} out of ${credential.usage.limit === 0 ? 'unlimited' : '$' + credential.usage.limit} limit`}
          {' used '}
          {resetPhrase}
        </Text12Regular>{' '}
        <Tooltip
          multiline
          w={400}
          label={`This is the total amount of credits used on model tokens ${resetPhrase}. Credits reset ${credential.usage.limitReset}.`}
        >
          <Box>
            <StyledLucideIcon Icon={InfoIcon} size={13} c="dimmed" />
          </Box>
        </Tooltip>
      </Group>
    </Stack>
  );
};
