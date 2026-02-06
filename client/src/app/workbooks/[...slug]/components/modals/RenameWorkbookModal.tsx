import { Group, Modal, Stack, TextInput } from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useWorkbookEditorUIStore, WorkbookModals } from '@/stores/workbook-editor-store';

export const RenameWorkbookModal = () => {
  const activeModal = useWorkbookEditorUIStore((state) => state.activeModal);
  const dismissModal = useWorkbookEditorUIStore((state) => state.dismissModal);
  const isOpen = activeModal?.type === WorkbookModals.RENAME_WORKBOOK;

  const { workbook, updateWorkbook } = useActiveWorkbook();
  const [workbookName, setWorkbookName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen && workbook) {
      setWorkbookName(workbook.name ?? '');
    }
  }, [isOpen, workbook]);

  const handleRename = useCallback(async () => {
    if (!workbook) return;
    try {
      setSaving(true);
      await updateWorkbook({ name: workbookName });
      ScratchpadNotifications.success({
        message: 'The workbook was renamed.',
      });
      dismissModal(WorkbookModals.RENAME_WORKBOOK);
    } catch {
      ScratchpadNotifications.error({
        title: 'Renaming failed',
        message: 'There was an error renaming the workbook to ' + workbookName,
      });
    } finally {
      setSaving(false);
    }
  }, [dismissModal, updateWorkbook, workbook, workbookName]);

  return (
    <Modal
      opened={isOpen}
      onClose={() => dismissModal(WorkbookModals.RENAME_WORKBOOK)}
      title="Rename workbook"
      centered
      size="lg"
    >
      <Stack>
        <TextInput label="Name" value={workbookName} onChange={(e) => setWorkbookName(e.target.value)} />
        <Group justify="flex-end">
          <ButtonSecondaryOutline onClick={() => dismissModal(WorkbookModals.RENAME_WORKBOOK)}>
            Cancel
          </ButtonSecondaryOutline>
          <ButtonPrimaryLight onClick={handleRename} loading={saving}>
            Save
          </ButtonPrimaryLight>
        </Group>
      </Stack>
    </Modal>
  );
};
