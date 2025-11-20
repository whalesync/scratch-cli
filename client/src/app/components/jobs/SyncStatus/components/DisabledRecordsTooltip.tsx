import { HoverCard, Stack, Table, Text } from '@mantine/core';
import React from 'react';
import classes from './DisabledRecordsTooltip.module.css';

interface DisabledRecordsTooltipProps {
  coreBase: string;
  children: React.ReactNode;
  syncDisabledTotal: number;
}

export function DisabledRecordsTooltip({ children }: DisabledRecordsTooltipProps): React.ReactNode {
  return (
    <HoverCard
      width={600}
      shadow="md"
      radius="md"
      withArrow
      styles={(theme) => ({
        dropdown: { overflow: 'hidden', borderColor: theme.colors.gray[5] },
      })}
    >
      <HoverCard.Target>
        <Text component="span" style={{ cursor: 'pointer' }}>
          {children}
        </Text>
      </HoverCard.Target>
      <HoverCard.Dropdown p={0}>
        <Stack gap={0}>
          <Table c="gray.11" className={classes.table}>
            <Table.Thead bg="gray.1">
              <Table.Tr>
                <Table.Th className={`${classes.colRecord} ${classes.noWrap}`}>Record</Table.Th>
                <Table.Th className={`${classes.colTable} ${classes.noWrap}`}>Table</Table.Th>
                <Table.Th className={`${classes.colPaused} ${classes.noWrap}`}>Paused in</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody></Table.Tbody>
          </Table>

          <Text p="xs" c="gray.10" fz="sm" ta="right">
            and 1
          </Text>
        </Stack>
      </HoverCard.Dropdown>
    </HoverCard>
  );
}
