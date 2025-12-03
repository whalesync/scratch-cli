import { useOperationCounts } from '@/hooks/use-operation-counts';
import { SnapshotTable } from '@/types/server-entities/workbook';
import { Group, Loader, Stack, Text } from '@mantine/core';
import { WorkbookId } from '@spinner/shared-types';
import pluralize from 'pluralize';
import { FC, useEffect, useMemo, useState } from 'react';
import { ButtonPrimaryLight, ButtonSecondaryOutline } from './base/buttons';
import { ModalWrapper } from './ModalWrapper';
import { SelectTableRow } from './SelectTableRow';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedTableIds: string[]) => void;
  tables: SnapshotTable[];
  currentTableId?: string;
  title: string;
  workbookId: WorkbookId;
}

export const TableSelectorModal: FC<Props> = (props) => {
  const { isOpen, onClose, onConfirm, tables, currentTableId, title, workbookId } = props;
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const { operationCounts, isLoading, error } = useOperationCounts(workbookId);

  const tablesWithChanges = useMemo(() => {
    const set = new Set<string>();
    if (operationCounts) {
      operationCounts.forEach((item) => {
        if (item.creates > 0 || item.updates > 0 || item.deletes > 0) {
          set.add(item.tableId);
        }
      });
    }
    return set;
  }, [operationCounts]);

  const availableTables = useMemo(() => {
    return tables.filter((table) => tablesWithChanges.has(table.id) || table.syncInProgress);
  }, [tables, tablesWithChanges]);

  // Initialize selection when availableTables changes
  useEffect(() => {
    if (availableTables.length > 0) {
      // If current table is in the list, select it. Otherwise select nothing (or maybe all?)
      // User said: "Essentially drop the option to use the current table, just preselect it."
      if (currentTableId && availableTables.some((t) => t.id === currentTableId && !t.syncInProgress)) {
        setSelectedTableIds([currentTableId]);
      } else {
        setSelectedTableIds([]);
      }
    }
  }, [availableTables, currentTableId]);

  const handleConfirm = () => {
    onConfirm(selectedTableIds);
  };

  const handleClose = () => {
    setSelectedTableIds([]);
    onClose();
  };

  const toggleTable = (tableId: string) => {
    setSelectedTableIds((prev) => (prev.includes(tableId) ? prev.filter((id) => id !== tableId) : [...prev, tableId]));
  };

  const getChangeCount = (tableId: string) => {
    if (!operationCounts) return 0;
    const item = operationCounts.find((c) => c.tableId === tableId);
    if (!item) return 0;
    return item.creates + item.updates + item.deletes;
  };

  const isSyncInProgress = useMemo(() => {
    return tables.some((t) => t.syncInProgress);
  }, [tables]);

  const footer = (
    <Group justify="flex-end">
      <ButtonSecondaryOutline onClick={handleClose}>Cancel</ButtonSecondaryOutline>
      <ButtonPrimaryLight onClick={handleConfirm} disabled={selectedTableIds.length === 0}>
        Continue
      </ButtonPrimaryLight>
    </Group>
  );

  return (
    <ModalWrapper customProps={{ footer }} opened={isOpen} onClose={handleClose} title={title} centered size="lg">
      <Stack>
        {isSyncInProgress && (
          <Text c="orange" size="sm" fw={500}>
            A publish job is currently in progress. The number of unpublished changes may update as records are
            processed.
          </Text>
        )}

        {isLoading ? (
          <Group justify="center" p="xl">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Checking for changes...
            </Text>
          </Group>
        ) : error ? (
          <Text c="red" size="sm">
            Error checking changes: {error.message}
          </Text>
        ) : availableTables.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            No tables with unpublished changes found.
          </Text>
        ) : (
          <Stack gap="xs">
            {availableTables.map((table) => {
              const changeCount = getChangeCount(table.id);
              const isSyncing = table.syncInProgress;
              const statusText = (
                <Text size="sm" c={isSyncing ? 'orange' : 'blue'}>
                  {isSyncing ? 'Publishing...' : `${changeCount} unpublished ${pluralize('change', changeCount)}`}
                </Text>
              );

              return (
                <SelectTableRow
                  key={table.id}
                  table={table}
                  isSelected={selectedTableIds.includes(table.id)}
                  disabled={isSyncing}
                  onToggle={toggleTable}
                  statusText={statusText}
                />
              );
            })}
          </Stack>
        )}
      </Stack>
    </ModalWrapper>
  );
};
