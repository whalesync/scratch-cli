import { Text13Regular } from '@/app/components/base/text';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { useAgentTokenUsage } from '@/hooks/use-agent-usage-stats';
import { AgentUsageEvent, UsageSummary } from '@/types/server-entities/agent-usage-events';
import { Center, Loader, Stack, Table, Tabs, Text } from '@mantine/core';
import { ArrowDownIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { SettingsPanel } from './SettingsPanel';

export const AgentUsageInfoCard = () => {
  const { events, summary, isLoading } = useAgentTokenUsage();

  return (
    <SettingsPanel title="Monthly AI Usage" subtitle="Review your requests and token usage.">
      {isLoading ? (
        <Center mih={200}>
          <Loader />
          <Text>Loading...</Text>
        </Center>
      ) : (
        <Tabs mih={200} defaultValue="summary">
          <Tabs.List>
            <Tabs.Tab value="summary">Summary</Tabs.Tab>
            <Tabs.Tab value="history">History</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="summary">
            <UsageSummaryTab summary={summary} />
          </Tabs.Panel>
          <Tabs.Panel value="history">
            <UsageEventListTab events={events} />
          </Tabs.Panel>
        </Tabs>
      )}
    </SettingsPanel>
  );
};

const UsageSummaryTab = ({ summary }: { summary?: UsageSummary }) => {
  const [sortBy, setSortBy] = useState<'model' | 'requests' | 'tokens'>('model');
  const sortedItems = useMemo(() => {
    return summary?.items.sort((a, b) => {
      if (sortBy === 'model') return a.model.localeCompare(b.model);
      if (sortBy === 'requests') return b.totalRequests - a.totalRequests;
      return b.totalTokens - a.totalTokens;
    });
  }, [summary, sortBy]);
  return (
    <Stack mt="md" gap="xs">
      <Text13Regular c="dimmed">
        Total usage for the current month: {summary?.totalTokens.toLocaleString()} tokens
      </Text13Regular>
      <Table.ScrollContainer minWidth={500} maxHeight={300} type="native">
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
            {sortedItems?.map((item) => (
              <Table.Tr key={item.model}>
                <Table.Td>{item.model}</Table.Td>
                <Table.Td ta="right">{item.totalRequests.toLocaleString()}</Table.Td>
                <Table.Td ta="right">{item.totalTokens.toLocaleString()}</Table.Td>
              </Table.Tr>
            ))}
            {sortedItems?.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={3} ta="center">
                  No tokens used yet this month
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
};

const UsageEventListTab = ({ events }: { events?: AgentUsageEvent[] }) => {
  return (
    <Table.ScrollContainer minWidth={500} maxHeight={500} type="native">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Model</Table.Th>
            <Table.Th>Credentials</Table.Th>
            <Table.Th ta="right">Requests</Table.Th>
            <Table.Th ta="right">Tokens</Table.Th>
            <Table.Th>
              When
              <StyledLucideIcon Icon={ArrowDownIcon} c="gray" size={12} ml="xs" />
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {events?.map((event) => (
            <Table.Tr key={event.id}>
              <Table.Td>{event.model}</Table.Td>
              <Table.Td>{event.context?.agent_credentials}</Table.Td>
              <Table.Td ta="right">{event.requests}</Table.Td>
              <Table.Td ta="right">{event.totalTokens}</Table.Td>
              <Table.Td>{new Date(event.createdAt).toLocaleString()}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
};
