import { Text12Regular } from '@/app/components/base/text';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { workbookApi } from '@/lib/api/workbook';
import { SnapshotTable } from '@/types/server-entities/workbook';
import { Box, Button, Group, Menu, Modal, Textarea } from '@mantine/core';
import { FunnelSimpleIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useActiveWorkbook } from '../../../../../../../hooks/use-active-workbook';
import { ButtonSecondaryInline } from '../../../../../../components/base/buttons';

export const FilterFooterButton = ({ table }: { table: SnapshotTable }) => {
  const { workbook, clearActiveRecordFilter } = useActiveWorkbook();

  // Local state
  const [sqlFilterModalOpen, setSqlFilterModalOpen] = useState(false);
  const [sqlFilterText, setSqlFilterText] = useState('');
  const [sqlFilterError, setSqlFilterError] = useState<string | null>(null);

  const currentTableFilter = useMemo(() => {
    return table.activeRecordSqlFilter || undefined;
  }, [table.activeRecordSqlFilter]);

  useEffect(() => {
    if (sqlFilterModalOpen) {
      setSqlFilterText(currentTableFilter || '');
      setSqlFilterError(null); // Clear any previous errors
    }
  }, [sqlFilterModalOpen, currentTableFilter]);

  const handleSetSqlFilter = useCallback(async () => {
    if (!table.id || !workbook) return;

    setSqlFilterError(null); // Clear any previous errors

    try {
      await workbookApi.setActiveRecordsFilter(workbook.id, table.id, sqlFilterText || undefined);
      ScratchpadNotifications.success({
        title: 'Filter Updated',
        message: 'SQL filter has been applied',
      });
      setSqlFilterModalOpen(false);
      setSqlFilterText('');
    } catch (error) {
      console.error('Error setting SQL filter:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to set SQL filter';
      setSqlFilterError(errorMessage);
    }
  }, [table.id, workbook, sqlFilterText]);

  return (
    <>
      {/* SQL Filter Modal */}
      <Modal opened={sqlFilterModalOpen} onClose={() => setSqlFilterModalOpen(false)} title="Set SQL Filter" size="md">
        <Box>
          <Text12Regular>Enter a SQL WHERE clause to filter records. Leave empty to clear the filter.</Text12Regular>
          <Text12Regular size="xs" c="dimmed" mb="md">
            Example: name = &apos;John&apos; AND age &gt; 25
          </Text12Regular>
          <Textarea
            label="SQL WHERE Clause"
            value={sqlFilterText}
            onChange={(e) => {
              setSqlFilterText(e.target.value);
              if (sqlFilterError) {
                setSqlFilterError(null); // Clear error when user starts typing
              }
            }}
            placeholder="Enter SQL WHERE clause..."
            minRows={3}
            error={sqlFilterError}
            mb="md"
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setSqlFilterModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetSqlFilter} loading={false}>
              Apply Filter
            </Button>
          </Group>
        </Box>
      </Modal>

      <Menu>
        <Menu.Target>
          <ButtonSecondaryInline leftSection={<FunnelSimpleIcon size={16} />}>Filter</ButtonSecondaryInline>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={() => setSqlFilterModalOpen(true)}>Set SQL Filter</Menu.Item>
          <Menu.Item disabled={!currentTableFilter} onClick={() => table.id && clearActiveRecordFilter(table.id)}>
            Clear Filter
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </>
  );
};
