import { Group, Modal, Stack } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { ButtonDangerLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { Text13Regular } from '@/app/components/base/text';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useWorkbook } from '@/hooks/use-workbook';
import { workbookApi } from '@/lib/api/workbook';
import { useWorkbookEditorUIStore, WorkbookModals } from '@/stores/workbook-editor-store';
import { RouteUrls } from '@/utils/route-urls';

export const DeleteWorkbookModal = () => {
  const activeModal = useWorkbookEditorUIStore((state) => state.activeModal);
  const dismissModal = useWorkbookEditorUIStore((state) => state.dismissModal);
  const isOpen = activeModal?.type === WorkbookModals.CONFIRM_DELETE;
  const router = useRouter();

  // Passing the workbookID explicitly since this is a dangerous operation.
  const workbookId = activeModal?.type === WorkbookModals.CONFIRM_DELETE ? activeModal.workbookId : null;
  const { workbook } = useWorkbook(workbookId);
  const [saving, setSaving] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!workbook) return;
    try {
      setSaving(true);
      await workbookApi.delete(workbook.id);
      ScratchpadNotifications.success({
        title: 'Workbook deleted',
        message: 'The workbook and its data is now deleted.',
      });

      router.push(RouteUrls.workbooksPageUrl);
    } catch (e) {
      console.log(e);
      ScratchpadNotifications.error({
        title: 'Deletion failed',
        message: 'There was an error deleting the workbook.',
      });
    } finally {
      setSaving(false);
    }
  }, [workbook, router]);

  if (!workbook) {
    return null;
  }

  return (
    <Modal
      opened={isOpen}
      onClose={() => dismissModal(WorkbookModals.CONFIRM_DELETE)}
      title={`Delete workbook ${workbook.name}`}
      centered
      size="lg"
    >
      <Stack>
        <Text13Regular>
          Are you sure you want to delete the {workbook.name} workbook? All data will be deleted.
        </Text13Regular>
        <Group justify="flex-end">
          <ButtonSecondaryOutline onClick={() => dismissModal(WorkbookModals.CONFIRM_DELETE)}>
            Cancel
          </ButtonSecondaryOutline>
          <ButtonDangerLight onClick={handleDelete} loading={saving}>
            Delete
          </ButtonDangerLight>
        </Group>
      </Stack>
    </Modal>
  );
};
