import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { usePublishSummary } from '@/hooks/use-publish-summary';
import { Anchor, Collapse, Group, Loader, Modal, ScrollArea, Stack, Text } from '@mantine/core';
import pluralize from 'pluralize';
import { useState } from 'react';

interface PublishConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  snapshotId: string;
  serviceName?: string;
  isPublishing: boolean;
}

export const PublishConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  snapshotId,
  serviceName,
  isPublishing,
}: PublishConfirmationModalProps) => {
  const [showChanges, setShowChanges] = useState(false);
  const { publishSummary, isLoading: isLoadingSummary, fetchSummary } = usePublishSummary(snapshotId);

  const handleClose = () => {
    setShowChanges(false);
    onClose();
  };

  const handleShowChanges = () => {
    setShowChanges(!showChanges);
    if (!showChanges) {
      // Always refetch when showing changes to get the latest data
      fetchSummary();
    }
  };

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
      <Stack>
        <Text c="orange.6">Your original data will be overwritten.</Text>

        <Group justify="space-between" align="center">
          <Anchor onClick={handleShowChanges} style={{ cursor: 'pointer' }}>
            {showChanges ? 'Hide changes' : 'Show changes'}
          </Anchor>
        </Group>

        <Collapse in={showChanges}>
          {isLoadingSummary ? (
            <Group gap="xs">
              <Loader size="xs" />
              <Text>Loading changes...</Text>
            </Group>
          ) : publishSummary ? (
            <ScrollArea h={300}>
              <Stack gap="md">
                {publishSummary.creates.length > 0 && (
                  <Stack gap="xs">
                    <Text fw={500} c="green.6">
                      Records to be created:
                    </Text>
                    {publishSummary.creates.map((table) => (
                      <Text key={table.tableId} size="sm">
                        <strong>{table.tableName}:</strong> {table.count} {pluralize('record', table.count)}
                      </Text>
                    ))}
                  </Stack>
                )}

                {publishSummary.updates.length > 0 && (
                  <Stack gap="xs">
                    <Text fw={500} c="blue.6">
                      Records to be updated:
                    </Text>
                    {publishSummary.updates.map((table) => (
                      <Stack key={table.tableId} gap="xs">
                        <Text size="sm" fw={500}>
                          {table.tableName}:
                        </Text>
                        {table.records.map((record) => (
                          <Stack key={record.wsId} gap="xs" ml="md">
                            <Text size="sm">{record.title}</Text>
                            <Stack gap="xs" ml="md">
                              {Object.entries(record.changes).map(([field, change]) => (
                                <Text key={field} size="xs" c="dimmed">
                                  <strong>{field}:</strong> {String(change.from)} → {String(change.to)}
                                </Text>
                              ))}
                            </Stack>
                          </Stack>
                        ))}
                      </Stack>
                    ))}
                  </Stack>
                )}

                {publishSummary.deletes.length > 0 && (
                  <Stack gap="xs">
                    <Text fw={500} c="red.6">
                      Records to be deleted:
                    </Text>
                    {publishSummary.deletes.map((table) => (
                      <Stack key={table.tableId} gap="xs">
                        <Text size="sm" fw={500}>
                          {table.tableName}:
                        </Text>
                        {table.records.map((record) => (
                          <Text key={record.wsId} size="sm" ml="md">
                            {record.title}
                          </Text>
                        ))}
                      </Stack>
                    ))}
                  </Stack>
                )}

                {publishSummary.creates.length === 0 &&
                  publishSummary.updates.length === 0 &&
                  publishSummary.deletes.length === 0 && <Text c="dimmed">No changes to publish.</Text>}
              </Stack>
            </ScrollArea>
          ) : (
            <Text c="red">Failed to load changes summary.</Text>
          )}
        </Collapse>

        <Group justify="flex-end">
          <ButtonSecondaryOutline onClick={handleClose} disabled={isPublishing}>
            Cancel
          </ButtonSecondaryOutline>
          <ButtonPrimaryLight
            onClick={async () => {
              onConfirm();
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
