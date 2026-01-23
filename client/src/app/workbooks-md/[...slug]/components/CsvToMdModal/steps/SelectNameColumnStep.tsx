'use client';

import { Badge, Box, Button, Group, Radio, ScrollArea, Stack, Text } from '@mantine/core';
import type { SelectNameColumnStepProps } from '../types';

export function SelectNameColumnStep({
  columns,
  includedColumns,
  selectedColumn,
  onSelectionChange,
  onNext,
  onBack,
}: SelectNameColumnStepProps) {
  // Filter to only show included columns
  const availableColumns = columns.filter((c) => includedColumns.includes(c.name));
  const canProceed = selectedColumn !== '';

  return (
    <Stack gap="md">
      <Text size="sm" c="var(--fg-secondary)">
        Select the column to use for generating filenames. The values in this column will be
        converted to URL-friendly slugs (e.g., &quot;My Post Title&quot; becomes &quot;my-post-title.md&quot;).
      </Text>

      <ScrollArea h={300} style={{ border: '1px solid var(--fg-divider)', borderRadius: '4px' }}>
        <Radio.Group value={selectedColumn} onChange={onSelectionChange}>
          <Stack gap={0} p="xs">
            {availableColumns.map((column) => {
              const isSelected = selectedColumn === column.name;
              const samplePreview =
                column.sampleValues.length > 0
                  ? column.sampleValues.slice(0, 3).join(', ')
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
                  onClick={() => onSelectionChange(column.name)}
                >
                  <Group gap="sm" wrap="nowrap">
                    <Radio value={column.name} />
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
                        Sample values: {samplePreview}
                      </Text>
                    </Stack>
                  </Group>
                </Box>
              );
            })}
          </Stack>
        </Radio.Group>
      </ScrollArea>

      <Group justify="flex-end" gap="sm">
        <Button variant="subtle" color="gray" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!canProceed}>
          Next
        </Button>
      </Group>
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
