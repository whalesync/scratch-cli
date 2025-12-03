import { Text13Book, Text13Regular } from '@/app/components/base/text';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { isOverCreditLimit, useAgentCredentials } from '@/hooks/use-agent-credentials';
import { Box, Group, Progress, Stack, Tooltip } from '@mantine/core';
import { InfoIcon } from 'lucide-react';
import { BillingSection } from './BillingSection';

export const TokenUsageSection = () => {
  const { systemOpenRouterCredential } = useAgentCredentials(true);

  if (!systemOpenRouterCredential || !systemOpenRouterCredential.usage) {
    return null;
  }

  // limit is 0 for unlimited, set arbitrary high max for the progress bar
  const max = systemOpenRouterCredential.usage.limit === 0 ? 10000 : systemOpenRouterCredential.usage.limit;
  const value = systemOpenRouterCredential.usage.usage === 0 ? 0 : (systemOpenRouterCredential.usage.usage / max) * 100;

  const usedAmount = Number(Math.max(systemOpenRouterCredential.usage.usage, 0.0)).toFixed(2);
  const limitAmount =
    systemOpenRouterCredential.usage.limit === 0
      ? 'unlimited'
      : '$' + systemOpenRouterCredential.usage.limit.toFixed(2);

  return (
    <BillingSection title="Token usage" subtitle="Your usage of OpenRouter tokens provided by Scratch">
      <Stack gap="xs">
        <Text13Regular>Token usage</Text13Regular>
        <Progress value={value} color={isOverCreditLimit(systemOpenRouterCredential) ? 'red.6' : 'green.6'} />
        <Group gap="xs" align="center">
          <Text13Book c="dimmed">{`$${usedAmount} used out ${limitAmount} used this month`}</Text13Book>

          <Tooltip
            multiline
            w={300}
            label="This is the total amount of credits used on model tokens this month. Credits reset at the start of each month."
          >
            <Box>
              <StyledLucideIcon Icon={InfoIcon} size={13} c="dimmed" />
            </Box>
          </Tooltip>
        </Group>
      </Stack>
    </BillingSection>
  );
};
