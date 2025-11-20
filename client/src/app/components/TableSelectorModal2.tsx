import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { ConnectorIcon } from '@/app/components/ConnectorIcon';
import { useOperationCounts } from '@/hooks/use-operation-counts';
import { WorkbookId } from '@/types/server-entities/ids';
import { SnapshotTable } from '@/types/server-entities/workbook';
import { Checkbox, Group, Loader, Modal, Stack, Text } from '@mantine/core';
import pluralize from 'pluralize';
import { useEffect, useMemo, useState } from 'react';

interface TableSelectorModal2Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedTableIds: string[]) => void;
  tables: SnapshotTable[];
  currentTableId?: string;
  title?: string;
  description?: string;
  workbookId: WorkbookId;
}

export function TableSelectorModal2({
  isOpen,
  onClose,
  onConfirm,
  tables,
  currentTableId,
  title = 'Select Tables',
  description,
  workbookId,
}: TableSelectorModal2Props) {
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const { operationCounts, isLoading, error, fetchCounts } = useOperationCounts(workbookId);

  useEffect(() => {
    if (isOpen) {
      void fetchCounts();
    }
  }, [isOpen, fetchCounts]);

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

  return (
    <Modal opened={isOpen} onClose={handleClose} title={title} centered size="lg">
      <Stack>
        {description && (
          <Text c="dimmed" size="sm">
            {description}
          </Text>
        )}

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
              const isSelected = selectedTableIds.includes(table.id);
              const changeCount = getChangeCount(table.id);
              const isSyncing = table.syncInProgress;

              return (
                <Group
                  key={table.id}
                  p="xs"
                  style={{
                    border: '1px solid var(--mantine-color-gray-3)',
                    cursor: isSyncing ? 'not-allowed' : 'pointer',
                    backgroundColor: isSelected
                      ? 'var(--mantine-color-teal-0)'
                      : isSyncing
                        ? 'var(--mantine-color-gray-0)'
                        : 'transparent',
                    borderColor: isSelected ? 'var(--mantine-color-teal-4)' : 'var(--mantine-color-gray-3)',
                    opacity: isSyncing ? 0.7 : 1,
                  }}
                  onClick={() => !isSyncing && toggleTable(table.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    onChange={() => {}} // Handled by Group onClick
                    color="teal"
                    style={{ pointerEvents: 'none' }} // Pass clicks to Group
                    readOnly
                    disabled={isSyncing}
                  />
                  <ConnectorIcon connector={table.connectorService} size={22} />
                  <Text fw={500} c={isSyncing ? 'dimmed' : undefined}>
                    {table.tableSpec.name}
                  </Text>
                  <Text size="sm" c={isSyncing ? 'orange' : 'blue'} ml="auto">
                    {isSyncing ? 'Publishing...' : `${changeCount} unpublished ${pluralize('change', changeCount)}`}
                  </Text>
                </Group>
              );
            })}
          </Stack>
        )}

        <Group justify="flex-end" mt="md">
          <ButtonSecondaryOutline onClick={handleClose}>Cancel</ButtonSecondaryOutline>
          <ButtonPrimaryLight onClick={handleConfirm} disabled={selectedTableIds.length === 0}>
            Continue
          </ButtonPrimaryLight>
        </Group>
      </Stack>
    </Modal>
  );
}
