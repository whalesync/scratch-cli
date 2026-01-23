'use client';

import { Badge, Box, Button, Checkbox, Group, ScrollArea, Stack, Text } from '@mantine/core';
import type { SelectColumnsStepProps } from '../types';

export function SelectColumnsStep({
  columns,
  selectedColumns,
  onSelectionChange,
  onNext,
}: SelectColumnsStepProps) {
  const allSelected = selectedColumns.length === columns.length;
  const canProceed = selectedColumns.length >= 2;

  const handleToggleAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(columns.map((c) => c.name));
    }
  };

  const handleToggleColumn = (columnName: string) => {
    if (selectedColumns.includes(columnName)) {
      onSelectionChange(selectedColumns.filter((c) => c !== columnName));
    } else {
      onSelectionChange([...selectedColumns, columnName]);
    }
  };

  return (
    <Stack gap="md">
      <Text size="sm" c="var(--fg-secondary)">
        Select which columns to include in the markdown files. At least 2 columns are required.
      </Text>

      <Group justify="space-between">
        <Text size="sm" fw={500}>
          {selectedColumns.length} of {columns.length} columns selected
        </Text>
        <Button variant="subtle" size="xs" onClick={handleToggleAll}>
          {allSelected ? 'Deselect All' : 'Select All'}
        </Button>
      </Group>

      <ScrollArea h={300} style={{ border: '1px solid var(--fg-divider)', borderRadius: '4px' }}>
        <Stack gap={0} p="xs">
          {columns.map((column) => {
            const isSelected = selectedColumns.includes(column.name);
            const samplePreview =
              column.sampleValues.length > 0
                ? column.sampleValues[0].length > 40
                  ? column.sampleValues[0].slice(0, 40) + '...'
                  : column.sampleValues[0]
                : '(empty)';

            return (
              <Box
                key={column.name}
                p="xs"
                style={{
                  borderRadius: '4px',
                  backgroundColor: isSelected ? 'var(--mantine-color-blue-0)' : 'transparent',
                  cursor: 'pointer',
                }}
                onClick={() => handleToggleColumn(column.name)}
              >
                <Group gap="sm" wrap="nowrap">
                  <Checkbox checked={isSelected} onChange={() => {}} readOnly />
                  <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                    <Group gap="xs">
                      <Text size="sm" fw={500} truncate>
                        {column.name}
                      </Text>
                      <Badge size="xs" variant="light" color={getTypeColor(column.inferredType)}>
                        {column.inferredType}
                      </Badge>
                    </Group>
                    <Text size="xs" c="var(--fg-muted)" truncate>
                      {samplePreview}
                    </Text>
                  </Stack>
                </Group>
              </Box>
            );
          })}
        </Stack>
      </ScrollArea>

      <Group justify="flex-end" gap="sm">
        <Button onClick={onNext} disabled={!canProceed}>
          Next
        </Button>
      </Group>

      {!canProceed && (
        <Text size="xs" c="var(--mantine-color-red-6)">
          Please select at least 2 columns to continue.
        </Text>
      )}
    </Stack>
  );
}

function getTypeColor(type: string): string {
  switch (type) {
    case 'number':
      return 'blue';
    case 'boolean':
      return 'green';
    default:
      return 'gray';
  }
}
