import { Text12Regular } from '@/app/components/base/text';
import { isOverCreditLimit } from '@/hooks/use-agent-credentials';
import { AiAgentCredential } from '@/types/server-entities/agent-credentials';
import { Progress, Stack } from '@mantine/core';

export const CredentialLimit = ({ credential }: { credential: AiAgentCredential }) => {
  if (!credential.usage) {
    return null;
  }

  // limit is 0 for unlimited, set arbitrary high max for the progress bar
  const max = credential.usage.limit === 0 ? 10000 : credential.usage.limit;
  const value = credential.usage.usage === 0 ? 0 : (credential.usage.usage / max) * 100;

  return (
    <Stack gap="xs">
      <Progress value={value} color={isOverCreditLimit(credential) ? 'red.6' : 'green.6'} />
      <Text12Regular c="dimmed">
        {`$${Number(Math.max(credential.usage.usage, 0.01)).toFixed(2)} used out of ${credential.usage.limit === 0 ? 'unlimited' : '$' + credential.usage.limit} limit`}{' '}
        {credential.usage.limitReset && `(${credential.usage.limitReset})`}
      </Text12Regular>
    </Stack>
  );
};
