import { ConnectorIcon } from '@/app/components/Icons/ConnectorIcon';
import { SnapshotTable } from '@spinner/shared-types';
import { Box, Checkbox, Group, Text } from '@mantine/core';
import { FC, ReactNode } from 'react';

interface Props {
  table: SnapshotTable;
  isSelected: boolean;
  disabled: boolean;
  onToggle: (tableId: string) => void;
  statusText: ReactNode;
  /** Optional display name override (e.g., for showing folder name instead of table name) */
  displayName?: string;
}

export const SelectTableRow: FC<Props> = ({ table, isSelected, disabled, onToggle, statusText, displayName }) => {
  return (
    <Group
      p="xs"
      style={{
        border: '0.5px solid var(--mantine-color-gray-3)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: isSelected
          ? 'var(--mantine-color-teal-0)'
          : disabled
            ? 'var(--mantine-color-gray-0)'
            : 'transparent',
        borderColor: isSelected ? 'var(--mantine-color-teal-4)' : 'var(--mantine-color-gray-3)',
        opacity: disabled ? 0.7 : 1,
      }}
      onClick={() => !disabled && onToggle(table.id)}
    >
      <Checkbox
        checked={isSelected}
        onChange={() => {}} // Handled by Group onClick
        color="teal"
        style={{ pointerEvents: 'none' }} // Pass clicks to Group
        readOnly
        disabled={disabled}
      />
      <ConnectorIcon connector={table.connectorService} size={22} />
      <Text fw={500} c={disabled ? 'dimmed' : undefined}>
        {displayName ?? table.tableSpec.name}
      </Text>
      <Box ml="auto">{statusText}</Box>
    </Group>
  );
};
