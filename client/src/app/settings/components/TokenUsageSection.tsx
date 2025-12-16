import { Text13Regular } from '@/app/components/base/text';
import { ConfigSection } from '@/app/components/ConfigSection';
import { ModelProviderIcon } from '@/app/components/Icons/ModelProvidericon';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { LoaderWithMessage } from '@/app/components/LoaderWithMessage';
import customBordersClasses from '@/app/components/theme/custom-borders.module.css';
import { useAgentCredentials } from '@/hooks/use-agent-credentials';
import { useAgentTokenUsage } from '@/hooks/use-agent-usage-stats';
import { Box, Center, Group, Select, Stack, Table, Tabs, Tooltip } from '@mantine/core';
import { AgentUsageEvent, UsageSummary } from '@spinner/shared-types';
import { ArrowDownIcon, CalendarIcon, InfoIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export const TokenUsageSection = () => {
  const { agentCredentials, isLoading: isLoadingCredentials } = useAgentCredentials(false);
  const {
    summary,
    events,
    isLoading: isLoadingSummary,
    credentialFilter,
    monthFilter,
    setCredentialFilter,
    setMonthFilter,
  } = useAgentTokenUsage();

  useEffect(() => {
    if (!monthFilter) {
      setMonthFilter(LAST_6_MONTHS[0].value);
    }
    if (!credentialFilter) {
      setCredentialFilter(agentCredentials?.[0]?.id ?? '');
    }
  }, [monthFilter, credentialFilter, agentCredentials, setMonthFilter, setCredentialFilter]);

  const openRouterApiCredentials = useMemo(() => {
    return agentCredentials?.map((credential) => ({
      label: credential.name,
      value: credential.id,
    }));
  }, [agentCredentials]);

  const selectedCredential = useMemo(() => {
    return agentCredentials?.find((credential) => credential.id === credentialFilter);
  }, [agentCredentials, credentialFilter]);

  return (
    <ConfigSection title="Usage" description="View usage for each model provider and model." hasBorder={false} p="0">
      {isLoadingCredentials ? (
        <Center mih={100}>
          <LoaderWithMessage message="Loading..." size="sm" centered />
        </Center>
      ) : (
        <Stack gap="16px">
          <Group gap="12px" grow>
            <Stack gap="12px">
              <Text13Regular>Model provider</Text13Regular>
              <Select
                size="sm"
                data={openRouterApiCredentials}
                value={credentialFilter}
                onChange={(value) => setCredentialFilter(value ?? '')}
                leftSection={
                  selectedCredential && selectedCredential.source === 'SYSTEM' ? (
                    <ModelProviderIcon model={'scratch'} size={24} withBorder={false} />
                  ) : undefined
                }
              />
            </Stack>
            <Stack gap="12px">
              <Text13Regular>Month</Text13Regular>
              <Select
                size="sm"
                leftSection={<StyledLucideIcon Icon={CalendarIcon} size="md" />}
                data={LAST_6_MONTHS}
                value={monthFilter}
                onChange={(value) => setMonthFilter(value ?? '')}
              />
            </Stack>
          </Group>
          <Box className={customBordersClasses.cornerBorders}>
            <Tabs defaultValue="per-model">
              <Tabs.List>
                <Tabs.Tab value="per-model">Per model</Tabs.Tab>
                <Tabs.Tab value="all-sessions">All sessions</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="per-model">
                <UsagePerModelTable summary={summary} loading={isLoadingSummary} />
              </Tabs.Panel>
              <Tabs.Panel value="all-sessions">
                <UsageEventListTable events={events} loading={isLoadingSummary} />
              </Tabs.Panel>
            </Tabs>
          </Box>
        </Stack>
      )}
    </ConfigSection>
  );
};

const UsagePerModelTable = ({ summary, loading }: { summary?: UsageSummary; loading: boolean }) => {
  const [sortBy, setSortBy] = useState<'model' | 'requests' | 'tokens'>('model');
  const sortedItems = useMemo(() => {
    return summary?.items.sort((a, b) => {
      if (sortBy === 'model') return a.model.localeCompare(b.model);
      if (sortBy === 'requests') return b.totalRequests - a.totalRequests;
      return b.totalTokens - a.totalTokens;
    });
  }, [summary, sortBy]);

  const [totalRequests, totalTokens] = useMemo(() => {
    return [
      sortedItems?.reduce((acc, item) => acc + item.totalRequests, 0) ?? 0,
      sortedItems?.reduce((acc, item) => acc + item.totalTokens, 0) ?? 0,
    ];
  }, [sortedItems]);

  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th onClick={() => setSortBy('model')} style={{ cursor: 'pointer' }} w="50%">
            Model
            {sortBy === 'model' && <StyledLucideIcon Icon={ArrowDownIcon} c="gray" size={12} ml="xs" />}
          </Table.Th>
          <Table.Th ta="right" onClick={() => setSortBy('requests')} style={{ cursor: 'pointer' }} w="25%">
            {sortBy === 'requests' && <StyledLucideIcon Icon={ArrowDownIcon} c="gray" size={12} mr="xs" />}
            Requests
          </Table.Th>
          <Table.Th ta="right" onClick={() => setSortBy('tokens')} style={{ cursor: 'pointer' }}>
            {sortBy === 'tokens' && <StyledLucideIcon Icon={ArrowDownIcon} c="gray" size={12} mr="xs" />}
            Tokens
          </Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {sortedItems &&
          sortedItems?.map((item) => (
            <Table.Tr key={item.model}>
              <Table.Td>
                <Group gap="4px">
                  <ModelProviderIcon model={item.model} size={24} withBorder />
                  {item.model}
                </Group>
              </Table.Td>
              <Table.Td ta="right">{item.totalRequests.toLocaleString()}</Table.Td>
              <Table.Td ta="right">{item.totalTokens.toLocaleString()}</Table.Td>
            </Table.Tr>
          ))}
        {loading ? (
          <Table.Tr>
            <Table.Td colSpan={3} ta="center">
              <LoaderWithMessage message="Loading usage data..." size="sm" centered />
            </Table.Td>
          </Table.Tr>
        ) : sortedItems?.length === 0 ? (
          <Table.Tr>
            <Table.Td colSpan={3} ta="center">
              No usage data for this month and provider
            </Table.Td>
          </Table.Tr>
        ) : (
          <Table.Tr>
            <Table.Td>Total</Table.Td>
            <Table.Td ta="right">{totalRequests.toLocaleString()}</Table.Td>
            <Table.Td ta="right">{totalTokens.toLocaleString()}</Table.Td>
          </Table.Tr>
        )}
      </Table.Tbody>
    </Table>
  );
};

const UsageEventListTable = ({ events, loading }: { events?: AgentUsageEvent[]; loading: boolean }) => {
  const [totalRequests, totalTokens] = useMemo(() => {
    return [
      events?.reduce((acc, event) => acc + event.requests, 0) ?? 0,
      events?.reduce((acc, event) => acc + event.totalTokens, 0) ?? 0,
    ];
  }, [events]);

  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th w="50%">Model</Table.Th>
          <Table.Th>
            When
            <StyledLucideIcon Icon={ArrowDownIcon} c="gray" size={12} ml="xs" />
          </Table.Th>
          <Table.Th ta="right">Requests</Table.Th>
          <Table.Th ta="right">Tokens</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {loading ? (
          <Table.Tr>
            <Table.Td colSpan={5} ta="center">
              <LoaderWithMessage message="Loading usage data..." size="sm" centered />
            </Table.Td>
          </Table.Tr>
        ) : !events || events.length === 0 ? (
          <Table.Tr>
            <Table.Td colSpan={5} ta="center">
              No usage data events for this month and provider
            </Table.Td>
          </Table.Tr>
        ) : (
          <>
            {events?.map((event) => (
              <Table.Tr key={event.id}>
                <Table.Td>
                  <Group gap="4px">
                    <ModelProviderIcon model={event.model} size={24} withBorder />
                    {event.model}
                    {event.context?.cancelled_by_user && (
                      <Tooltip label="Session canceled by user">
                        <Box>
                          <StyledLucideIcon Icon={InfoIcon} size={12} c="var(--fg-muted)" />
                        </Box>
                      </Tooltip>
                    )}
                  </Group>
                </Table.Td>
                <Table.Td>{new Date(event.createdAt).toLocaleDateString()}</Table.Td>
                <Table.Td ta="right">{event.requests.toLocaleString()}</Table.Td>
                <Table.Td ta="right">{event.totalTokens.toLocaleString()}</Table.Td>
              </Table.Tr>
            ))}
            <Table.Tr>
              <Table.Td>Total</Table.Td>
              <Table.Td />
              <Table.Td ta="right">{totalRequests.toLocaleString()}</Table.Td>
              <Table.Td ta="right">{totalTokens.toLocaleString()}</Table.Td>
            </Table.Tr>
          </>
        )}
      </Table.Tbody>
    </Table>
  );
};

const LAST_6_MONTHS = (() => {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const monthsArray = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date(Date.UTC(currentYear, currentMonth - i, 1));
    const monthIndex = date.getUTCMonth();
    const year = date.getUTCFullYear();
    const isCurrentMonth = monthIndex === currentMonth && year === currentYear;

    monthsArray.push({
      label: isCurrentMonth ? `Current month` : `${monthNames[monthIndex]} ${year}`,
      value: date.toUTCString(),
    });
  }
  monthsArray.reverse();
  return monthsArray;
})();
