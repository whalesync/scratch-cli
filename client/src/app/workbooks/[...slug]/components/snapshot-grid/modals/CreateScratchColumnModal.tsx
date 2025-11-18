import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { workbookApi } from '@/lib/api/workbook';
import { PostgresColumnType } from '@/types/server-entities/workbook';
import { Group, Modal, Select, Stack, TextInput } from '@mantine/core';
import { useState } from 'react';
import { SnapshotTableId, WorkbookId } from '../../../../../../types/server-entities/ids';

interface CreateScratchColumnModalProps {
  opened: boolean;
  onClose: () => void;
  workbookId: WorkbookId;
  tableId: SnapshotTableId;
}

const DATA_TYPE_OPTIONS = [
  { value: PostgresColumnType.TEXT, label: 'Text' },
  { value: PostgresColumnType.NUMERIC, label: 'Number' },
  { value: PostgresColumnType.BOOLEAN, label: 'Flag' },
  { value: PostgresColumnType.TIMESTAMP, label: 'Date' },
] as const;

export const CreateScratchColumnModal = ({ opened, onClose, workbookId, tableId }: CreateScratchColumnModalProps) => {
  const [columnName, setColumnName] = useState('');
  const [dataType, setDataType] = useState<PostgresColumnType>(PostgresColumnType.TEXT);
  const [isCreating, setIsCreating] = useState(false);

  const handleClose = () => {
    if (!isCreating) {
      setColumnName('');
      setDataType(PostgresColumnType.TEXT);
      onClose();
    }
  };

  const handleCreate = async () => {
    if (!columnName.trim() || !dataType) {
      return;
    }

    setIsCreating(true);
    try {
      await workbookApi.addScratchColumn(workbookId, tableId, {
        columnName: columnName.trim(),
        dataType,
      });

      ScratchpadNotifications.success({
        title: 'Column created',
        message: `Successfully created column "${columnName.trim()}"`,
      });

      setColumnName('');
      setDataType(PostgresColumnType.TEXT);
      onClose();
    } catch (error) {
      console.debug('Failed to create scratch column:', error);
      ScratchpadNotifications.error({
        title: 'Failed to create column',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const isFormValid = columnName.trim().length > 0 && dataType !== null;

  return (
    <Modal opened={opened} onClose={handleClose} title="Create Column" centered size="md">
      <Stack gap="md">
        <TextInput
          label="Column Name"
          placeholder="Enter column name"
          value={columnName}
          onChange={(e) => setColumnName(e.target.value)}
          disabled={isCreating}
          required
          data-autofocus
        />

        <Select
          label="Data Type"
          placeholder="Select data type"
          value={dataType}
          onChange={(value) => setDataType(value as PostgresColumnType)}
          data={DATA_TYPE_OPTIONS}
          disabled={isCreating}
          required
        />

        <Group justify="flex-end" gap="sm">
          <ButtonSecondaryOutline onClick={handleClose} disabled={isCreating}>
            Cancel
          </ButtonSecondaryOutline>
          <ButtonPrimaryLight onClick={handleCreate} loading={isCreating} disabled={!isFormValid}>
            Create
          </ButtonPrimaryLight>
        </Group>
      </Stack>
    </Modal>
  );
};
