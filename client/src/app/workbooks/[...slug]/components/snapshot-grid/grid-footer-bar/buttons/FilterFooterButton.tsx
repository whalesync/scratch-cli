import { Text12Regular, Text13Regular } from '@/app/components/base/text';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { workbookApi } from '@/lib/api/workbook';
import { SnapshotTable } from '@/types/server-entities/workbook';
import { Box, Button, Group, Menu, Modal, Textarea } from '@mantine/core';
import { CheckIcon, CodeIcon, FunnelIcon, FunnelPlusIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useActiveWorkbook } from '../../../../../../../hooks/use-active-workbook';
import { ButtonSecondaryInline } from '../../../../../../components/base/buttons';

/** Magic SQL query to filter only edited records. This is a hack to show only filtered records by setting special sql. */
const ONLY_EDITED_RECORDS_SQL = `__edited_fields <> '{}'::jsonb`;

export const FilterFooterButton = ({ table }: { table: SnapshotTable }) => {
  const { clearActiveRecordFilter } = useActiveWorkbook();

  const [sqlFilterModalOpen, setSqlFilterModalOpen] = useState(false);

  // This is a hack. There's a premade filter for only edited records that just sets the SQL on the client.
  // If the sql still matches that, we show a checkmark next to it.
  const currentFilterType: 'custom' | 'only_edited' | null = useMemo(() => {
    if (table.activeRecordSqlFilter === ONLY_EDITED_RECORDS_SQL) {
      return 'only_edited';
    }
    if (!!table.activeRecordSqlFilter) {
      return 'custom';
    }
    return null;
  }, [table.activeRecordSqlFilter]);

  return (
    <>
      <Menu>
        <Menu.Target>
          <ButtonSecondaryInline
            leftSection={<FunnelIcon size={16} />}
            rightSection={
              // Status widget to show a filter is active.
              currentFilterType && (
                <Text13Regular c="var(--fg-muted)" bg="var(--bg-panel)" px={5} bd="1px solid var(--fg-divider)">
                  1
                </Text13Regular>
              )
            }
          >
            Filter
          </ButtonSecondaryInline>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            leftSection={<CodeIcon size={16} />}
            rightSection={currentFilterType === 'custom' ? <CheckIcon size={16} /> : null}
            onClick={() => setSqlFilterModalOpen(true)}
          >
            Custom SQL Filter
          </Menu.Item>
          <Menu.Item
            leftSection={<FunnelPlusIcon size={16} />}
            rightSection={currentFilterType === 'only_edited' ? <CheckIcon size={16} /> : null}
            onClick={async () => {
              await workbookApi.setActiveRecordsFilter(table.workbookId, table.id, ONLY_EDITED_RECORDS_SQL);
            }}
          >
            Unpublished changes
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            disabled={currentFilterType === null}
            onClick={() => table.id && clearActiveRecordFilter(table.id)}
          >
            Clear Filter
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <CustomSqlFilterModal table={table} isOpen={sqlFilterModalOpen} onClose={() => setSqlFilterModalOpen(false)} />
    </>
  );
};

const CustomSqlFilterModal = ({
  table,
  isOpen,
  onClose,
}: {
  table: SnapshotTable;
  isOpen: boolean;
  onClose: () => void;
}) => {
  const [sqlFilterText, setSqlFilterText] = useState('');
  const [sqlFilterError, setSqlFilterError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSqlFilterText(
        // Hack: clobber the premade filter for only edited records.
        table.activeRecordSqlFilter && table.activeRecordSqlFilter !== ONLY_EDITED_RECORDS_SQL
          ? table.activeRecordSqlFilter
          : '',
      );
      setSqlFilterError(null); // Clear any previous errors
    }
  }, [isOpen, table.activeRecordSqlFilter]);

  const handleSetSqlFilter = useCallback(async () => {
    setSqlFilterError(null); // Clear any previous errors

    try {
      await workbookApi.setActiveRecordsFilter(table.workbookId, table.id, sqlFilterText || undefined);
      ScratchpadNotifications.success({
        title: 'Filter Updated',
        message: 'SQL filter has been applied',
      });
      onClose();
      setSqlFilterText('');
    } catch (error) {
      console.error('Error setting SQL filter:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to set SQL filter';
      setSqlFilterError(errorMessage);
    }
  }, [table.workbookId, table.id, sqlFilterText, onClose]);

  return (
    <Modal opened={isOpen} onClose={onClose} title="Custom SQL Filter" size="md">
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
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSetSqlFilter} loading={false}>
            Apply Filter
          </Button>
        </Group>
      </Box>
    </Modal>
  );
};
