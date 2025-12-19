import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { useOperationCounts } from '@/hooks/use-operation-counts';
import { SnapshotTable } from '@spinner/shared-types';
import { Group, Modal, Stack, Text } from '@mantine/core';
import { Service, WorkbookId } from '@spinner/shared-types';
import { CircleAlertIcon } from 'lucide-react';
import { useMemo } from 'react';
import { StatusListItem } from './StatusListItem';
import { TablePublishStats } from './TablePublishStats';

interface PublishConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  workbookId: WorkbookId | null;
  serviceName?: string;
  isPublishing: boolean;
  snapshotTableIds: string[];
  snapshotTables: SnapshotTable[];
}

export const PublishConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  workbookId,
  serviceName,
  isPublishing,
  snapshotTableIds,
  snapshotTables,
}: PublishConfirmationModalProps) => {
  const { operationCounts, isLoading, error } = useOperationCounts(workbookId);

  const handleClose = () => {
    onClose();
  };

  // Create a map of tableId -> service for quick lookup
  const tableServiceMap = useMemo(() => {
    const map = new Map<string, Service | null>();
    snapshotTables.forEach((table) => {
      map.set(table.id, table.connectorService);
    });
    return map;
  }, [snapshotTables]);

  // Create a map of tableId -> tableName for quick lookup
  const tableNameMap = useMemo(() => {
    const map = new Map<string, string>();
    snapshotTables.forEach((table) => {
      map.set(table.id, table.tableSpec.name);
    });
    return map;
  }, [snapshotTables]);

  // Get all unique tables with their stats from the publish summary
  const tablesWithStats = useMemo(() => {
    if (!operationCounts) return [];

    // Filter counts to only include selected tables
    const selectedCounts = operationCounts.filter((count) => snapshotTableIds.includes(count.tableId));

    return selectedCounts.map((count) => ({
      tableId: count.tableId,
      tableName: tableNameMap.get(count.tableId) || 'Unknown Table',
      service: tableServiceMap.get(count.tableId) ?? null,
      newRecords: count.creates,
      updatedRecords: count.updates,
      deletedRecords: count.deletes,
    }));
  }, [operationCounts, snapshotTableIds, tableServiceMap, tableNameMap]);

  return (
    <Modal
      opened={isOpen}
      onClose={handleClose}
      title={
        <Text>
          Publishing data to <strong>{serviceName}</strong>.
        </Text>
      }
      centered
      size="lg"
    >
      <Stack gap="md">
        <Text>These changes will be published to {serviceName}:</Text>

        {isLoading ? (
          <Text c="dimmed">Loading summary...</Text>
        ) : error ? (
          <Text c="red">Error loading summary: {error.message}</Text>
        ) : tablesWithStats.length === 0 ? (
          <Text c="dimmed">No changes detected to publish.</Text>
        ) : (
          tablesWithStats.map((table) => (
            <TablePublishStats
              key={table.tableId}
              tableId={table.tableId}
              tableName={table.tableName}
              service={table.service}
              newRecords={table.newRecords}
              updatedRecords={table.updatedRecords}
              deletedRecords={table.deletedRecords}
            />
          ))
        )}
        <StatusListItem
          text1="Your original data will be overwritten."
          text2="This cannot be undone."
          iconProps={{ Icon: CircleAlertIcon, c: 'var(--mantine-color-gray-6)', size: 'md' }}
        />
        <Group justify="flex-end">
          <ButtonSecondaryOutline onClick={handleClose} disabled={isPublishing}>
            Cancel
          </ButtonSecondaryOutline>
          <ButtonPrimaryLight
            onClick={async () => {
              await onConfirm();
              handleClose();
            }}
            loading={isPublishing}
          >
            Publish Changes
          </ButtonPrimaryLight>
        </Group>
      </Stack>
    </Modal>
  );
};
