import { ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { Text13Regular } from '@/app/components/base/text';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { serviceName } from '@/service-naming-conventions';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { Alert, CheckIcon, Group, Loader, Modal } from '@mantine/core';
import { useDisclosure, useSetState } from '@mantine/hooks';
import { AlertCircleIcon } from 'lucide-react';
import { useState } from 'react';
import { PublishConfirmationModal } from './snapshot-grid/modals/PublishConfirmationModal';

type PublishResult = {
  result: 'none' | 'success' | 'error';
  message: string | null;
};

/**
 * A container component that handles the publish workflow and the modals involved. Triggered through the WorkbookEditorUIStore
 */
export const PublishWorkbookWorkflow = () => {
  const { workbook, activeTable, publish } = useActiveWorkbook();
  const [publishing, setPublishing] = useState(false);
  const { publishConfirmationOpen, closePublishConfirmation } = useWorkbookEditorUIStore();

  const [publishResultModalOpen, { open: openPublishResultModal, close: closePublishResultModal }] =
    useDisclosure(false);

  const [publishResult, setPublishResult] = useSetState<PublishResult>({
    result: 'none',
    message: '',
  });

  const handleConfirmPublish = async () => {
    if (!workbook) return;

    try {
      setPublishResult({ result: 'none', message: '' });
      setPublishing(true);
      closePublishConfirmation();
      openPublishResultModal();
      await publish?.();

      setPublishResult({
        result: 'success',
        message: `Your data has been published to ${activeTable?.connectorService ? serviceName(activeTable.connectorService) : 'unknown'}`,
      });
    } catch (e) {
      console.debug(e);
      setPublishResult({ result: 'error', message: (e as Error).message ?? 'There was an error publishing your data' });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <>
      {workbook && (
        <PublishConfirmationModal
          isOpen={publishConfirmationOpen}
          onClose={closePublishConfirmation}
          onConfirm={handleConfirmPublish}
          workbookId={workbook.id}
          serviceName={activeTable?.connectorService ? serviceName(activeTable.connectorService) : undefined}
          isPublishing={publishing}
        />
      )}
      <Modal
        opened={publishResultModalOpen}
        onClose={closePublishResultModal}
        title="Publishing workbook"
        centered
        size="md"
        closeOnClickOutside={false}
        closeOnEscape={false}
      >
        {publishing && (
          <Group gap="xs" wrap="nowrap">
            <Loader size="xs" />
            <Text13Regular>
              Your data is being published to{' '}
              {activeTable?.connectorService ? serviceName(activeTable.connectorService) : 'unknown'}.
            </Text13Regular>
          </Group>
        )}

        {publishResult.result === 'success' && !publishing && (
          <Group gap="xs" wrap="nowrap">
            <CheckIcon size={16} />
            <Text13Regular>
              Your data has been published to{' '}
              {activeTable?.connectorService ? serviceName(activeTable.connectorService) : 'unknown'}.
            </Text13Regular>
          </Group>
        )}

        {publishResult.result === 'error' && !publishing && (
          <Alert color="red" variant="light" icon={<AlertCircleIcon size={16} />}>
            {publishResult.message}
          </Alert>
        )}

        <Group justify="flex-end">
          <ButtonSecondaryOutline onClick={closePublishResultModal} disabled={publishing}>
            Close
          </ButtonSecondaryOutline>
        </Group>
      </Modal>
    </>
  );
};
