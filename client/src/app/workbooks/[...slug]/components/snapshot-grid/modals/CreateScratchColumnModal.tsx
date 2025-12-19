import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { ModalWrapper } from '@/app/components/ModalWrapper';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { workbookApi } from '@/lib/api/workbook';
import { PostgresColumnType } from '@spinner/shared-types';
import { Select, Stack, TextInput } from '@mantine/core';
import { useState } from 'react';
import { WorkbookModals, useWorkbookEditorUIStore } from '../../../../../../stores/workbook-editor-store';

const DATA_TYPE_OPTIONS = [
  { value: PostgresColumnType.TEXT, label: 'Text' },
  { value: PostgresColumnType.NUMERIC, label: 'Number' },
  { value: PostgresColumnType.BOOLEAN, label: 'Flag' },
  { value: PostgresColumnType.TIMESTAMP, label: 'Date' },
] as const;

/** Controlled by the WorkbookEditorUIStore */
export const CreateScratchColumnModal = () => {
  const activeModal = useWorkbookEditorUIStore((state) => state.activeModal);
  const dismissModal = useWorkbookEditorUIStore((state) => state.dismissModal);
  const workbookId = useWorkbookEditorUIStore((state) => state.workbookId);
  const isOpen = activeModal?.type === WorkbookModals.CREATE_SCRATCH_COLUMN;
  const tableId = activeModal?.type === WorkbookModals.CREATE_SCRATCH_COLUMN ? activeModal.tableId : null;

  const [columnName, setColumnName] = useState('');
  const [dataType, setDataType] = useState<PostgresColumnType>(PostgresColumnType.TEXT);
  const [isCreating, setIsCreating] = useState(false);

  const handleClose = () => {
    if (!isCreating) {
      setColumnName('');
      setDataType(PostgresColumnType.TEXT);
      dismissModal(WorkbookModals.CREATE_SCRATCH_COLUMN);
    }
  };

  const handleCreate = async () => {
    if (!columnName.trim() || !dataType || !workbookId || !tableId) {
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
      dismissModal(WorkbookModals.CREATE_SCRATCH_COLUMN);
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
    <ModalWrapper
      title="Create Column"
      customProps={{
        footer: (
          <>
            <ButtonSecondaryOutline onClick={handleClose} disabled={isCreating}>
              Cancel
            </ButtonSecondaryOutline>
            <ButtonPrimaryLight onClick={handleCreate} loading={isCreating} disabled={!isFormValid}>
              Create
            </ButtonPrimaryLight>
          </>
        ),
      }}
      opened={isOpen}
      onClose={handleClose}
      size="md"
    >
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
      </Stack>
    </ModalWrapper>
  );
};
