'use client';

import { SnapshotTable } from '@/types/server-entities/snapshot';
import { Checkbox, Group, Radio, Stack, Text } from '@mantine/core';
import { useState } from 'react';

export type TableSelectionMode = 'current' | 'multiple';

export type TableSelection = {
  mode: TableSelectionMode;
  tableIds: string[]; // SnapshotTable IDs
};

interface TableSelectionComponentProps {
  tables: SnapshotTable[];
  currentTableId: string;
  onChange: (selection: TableSelection) => void;
  initialSelection?: TableSelection;
}

export const TableSelectionComponent = ({
  tables,
  currentTableId,
  onChange,
  initialSelection,
}: TableSelectionComponentProps) => {
  const [mode, setMode] = useState<TableSelectionMode>(initialSelection?.mode || 'current');
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>(
    initialSelection?.tableIds || [currentTableId]
  );

  const handleModeChange = (newMode: TableSelectionMode) => {
    setMode(newMode);
    const newSelection: TableSelection = {
      mode: newMode,
      tableIds: newMode === 'current' ? [currentTableId] : selectedTableIds,
    };
    onChange(newSelection);
  };

  const handleTableToggle = (tableId: string) => {
    const newSelectedTableIds = selectedTableIds.includes(tableId)
      ? selectedTableIds.filter((id) => id !== tableId)
      : [...selectedTableIds, tableId];

    setSelectedTableIds(newSelectedTableIds);
    onChange({
      mode,
      tableIds: newSelectedTableIds,
    });
  };

  const currentTable = tables.find((t) => t.id === currentTableId);

  return (
    <Stack gap="md">
      <Radio.Group value={mode} onChange={(value) => handleModeChange(value as TableSelectionMode)}>
        <Stack gap="sm">
          <Radio value="current" label="Current table only" />
          <Radio value="multiple" label="Select multiple tables" />
        </Stack>
      </Radio.Group>

      {mode === 'current' && currentTable && (
        <Text size="sm" c="dimmed">
          Will process: <strong>{currentTable.tableSpec.name}</strong>
        </Text>
      )}

      {mode === 'multiple' && (
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            Select tables:
          </Text>
          {tables.map((table) => (
            <Checkbox
              key={table.id}
              checked={selectedTableIds.includes(table.id)}
              onChange={() => handleTableToggle(table.id)}
              label={
                <Group gap="xs">
                  <Text size="sm">{table.tableSpec.name}</Text>
                  {table.id === currentTableId && (
                    <Text size="xs" c="dimmed">
                      (current)
                    </Text>
                  )}
                </Group>
              }
            />
          ))}
          {selectedTableIds.length === 0 ? (
            <Text size="xs" c="red">
              Please select at least one table
            </Text>
          ) :  <Text size="xs" c="gray">
              {selectedTableIds.length} table(s) will be downloaded
            </Text>}
        </Stack>
      )}
    </Stack>
  );
};
