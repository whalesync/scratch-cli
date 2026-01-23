'use client';

import { Badge, Box, Button, Checkbox, Group, ScrollArea, Stack, Text } from '@mantine/core';
import type { SelectContentStepProps } from '../types';

export function SelectContentStep({
  columns,
  includedColumns,
  nameColumn,
  selectedColumns,
  onSelectionChange,
  onNext,
  onBack,
}: SelectContentStepProps) {
  // Filter to only show included columns minus the name column
  const availableColumns = columns.filter(
    (c) => includedColumns.includes(c.name) && c.name !== nameColumn
  );

  const metadataColumns = availableColumns
    .filter((c) => !selectedColumns.includes(c.name))
    .map((c) => c.name);

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
        Select columns to include in the markdown body. Unselected columns will become metadata in
        the YAML frontmatter.
      </Text>

      <Group gap="lg">
        <Text size="xs" c="var(--fg-muted)">
          Content columns: {selectedColumns.length > 0 ? selectedColumns.join(', ') : '(none)'}
        </Text>
        <Text size="xs" c="var(--fg-muted)">
          Metadata columns: {metadataColumns.length > 0 ? metadataColumns.join(', ') : '(none)'}
        </Text>
      </Group>

      <ScrollArea h={280} style={{ border: '1px solid var(--fg-divider)', borderRadius: '4px' }}>
        <Stack gap={0} p="xs">
          {availableColumns.map((column) => {
            const isSelected = selectedColumns.includes(column.name);
            const samplePreview =
              column.sampleValues.length > 0
                ? column.sampleValues[0].length > 60
                  ? column.sampleValues[0].slice(0, 60) + '...'
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
                      <Badge size="xs" variant="outline" color={isSelected ? 'blue' : 'gray'}>
                        {isSelected ? 'content' : 'metadata'}
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
        <Button variant="subtle" color="gray" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>
          {selectedColumns.length > 1 ? 'Next' : 'Preview'}
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
