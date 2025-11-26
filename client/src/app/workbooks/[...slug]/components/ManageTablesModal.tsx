'use client';

import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { ConnectorIcon } from '@/app/components/ConnectorIcon';
import { workbookApi } from '@/lib/api/workbook';
import { SnapshotTable } from '@/types/server-entities/workbook';
import { Checkbox, Group, Modal, Stack, Text } from '@mantine/core';
import { WorkbookId } from '@spinner/shared-types';
import { useEffect, useState } from 'react';

interface ManageTablesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void | Promise<void>;
  workbookId: WorkbookId;
  tables: SnapshotTable[];
}

export const ManageTablesModal = ({ isOpen, onClose, onSave, workbookId, tables }: ManageTablesModalProps) => {
  const [hiddenStates, setHiddenStates] = useState<Record<string, boolean>>(
    tables.reduce((acc, table) => ({ ...acc, [table.id]: table.hidden }), {}),
  );
  const [isSaving, setIsSaving] = useState(false);

  // Update hiddenStates when tables prop changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setHiddenStates(tables.reduce((acc, table) => ({ ...acc, [table.id]: table.hidden }), {}));
    }
  }, [tables, isOpen]);

  const handleToggle = (tableId: string) => {
    setHiddenStates((prev) => ({
      ...prev,
      [tableId]: !prev[tableId],
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Update all tables that have changed
      const updates = tables
        .filter((table) => hiddenStates[table.id] !== table.hidden)
        .map((table) => workbookApi.hideTable(workbookId, table.id, hiddenStates[table.id]));

      await Promise.all(updates);

      // Call onSave callback if provided, otherwise close modal
      if (onSave) {
        await onSave();
      }
      onClose();
    } catch (error) {
      console.error('Failed to update table visibility:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    // Reset states to original values
    setHiddenStates(tables.reduce((acc, table) => ({ ...acc, [table.id]: table.hidden }), {}));
    onClose();
  };

  return (
    <Modal opened={isOpen} onClose={handleClose} title="Manage Tables" size="md" centered>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Toggle which tables are visible in the workbook. Hidden tables are not deleted and can be unhidden at any
          time.
        </Text>

        <Stack gap="xs">
          {tables.map((table) => (
            <Group key={table.id} justify="space-between" wrap="nowrap" p="xs" style={{ borderRadius: 4 }}>
              <Group gap="xs" wrap="nowrap">
                <ConnectorIcon connector={table.connectorService} size={16} withBorder />
                <Text size="sm">{table.tableSpec.name}</Text>
              </Group>
              <Checkbox
                checked={!hiddenStates[table.id]}
                onChange={() => handleToggle(table.id)}
                label="Visible"
                styles={{
                  label: { fontSize: '12px' },
                }}
              />
            </Group>
          ))}
        </Stack>

        <Group justify="flex-end" mt="md">
          <ButtonSecondaryOutline onClick={handleClose}>Cancel</ButtonSecondaryOutline>
          <ButtonPrimaryLight onClick={handleSave} loading={isSaving}>
            Save Changes
          </ButtonPrimaryLight>
        </Group>
      </Stack>
    </Modal>
  );
};
