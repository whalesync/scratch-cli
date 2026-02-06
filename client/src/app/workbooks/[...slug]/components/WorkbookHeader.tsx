import { ButtonSecondaryInline, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { Text13Regular } from '@/app/components/base/text';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { PullProgressModal } from '@/app/components/jobs/pull/PullJobProgressModal';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { ToolIconButton } from '@/app/components/ToolIconButton';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { workbookApi } from '@/lib/api/workbook';
import { useLayoutManagerStore } from '@/stores/layout-manager-store';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { Group } from '@mantine/core';
import {
  CloudDownloadIcon,
  CloudUploadIcon,
  MessagesSquareIcon,
  PanelLeftIcon,
  SquareChevronRightIcon,
  Table2,
} from 'lucide-react';
import { useState } from 'react';
import { ConnectToCLIModal } from './modals/ConnectToCLIModal';
import { WorkbookActionsMenu } from './WorkbookActionsMenu';

export const WorkbookHeader = () => {
  const { workbook } = useActiveWorkbook();
  const toggleNavDrawer = useLayoutManagerStore((state) => state.toggleNavDrawer);
  const chatOpen = useWorkbookEditorUIStore((state) => state.chatOpen);
  const openChat = useWorkbookEditorUIStore((state) => state.openChat);
  const openDataFolderPublishConfirmation = useWorkbookEditorUIStore(
    (state) => state.openDataFolderPublishConfirmation,
  );

  const [pullJobId, setPullJobId] = useState<string | null>(null);
  const [isPulling, setIsPulling] = useState(false);
  const [cliModalOpened, setCliModalOpened] = useState(false);

  const handlePullAll = async () => {
    if (!workbook) return;
    setIsPulling(true);
    try {
      const result = await workbookApi.pullFiles(workbook.id);
      setPullJobId(result.jobId);
    } catch (e) {
      console.debug('Pull failed', e);
      ScratchpadNotifications.error({
        title: 'Pull failed',
        message: 'There was an error starting the pull.',
      });
    } finally {
      setIsPulling(false);
    }
  };

  const connectToCLIButton = (
    <ToolIconButton
      icon={SquareChevronRightIcon}
      onClick={() => setCliModalOpened(true)}
      size="md"
      tooltip="Connect to CLI"
    />
  );

  const pullButton = (
    <ButtonSecondaryOutline
      size="compact-xs"
      leftSection={<CloudDownloadIcon size={14} />}
      onClick={handlePullAll}
      loading={isPulling}
    >
      Pull All
    </ButtonSecondaryOutline>
  );

  const publishButton = (
    <ButtonSecondaryOutline
      size="compact-xs"
      leftSection={<CloudUploadIcon size={14} />}
      onClick={() => openDataFolderPublishConfirmation()}
    >
      Publish
    </ButtonSecondaryOutline>
  );

  return (
    <Group bg="var(--bg-panel)" h={36} justify="space-between" pos="relative" px="xs" gap="xs">
      <Group flex={1}>
        <ToolIconButton icon={PanelLeftIcon} onClick={toggleNavDrawer} size="md" />
      </Group>

      <Group gap={6}>
        <StyledLucideIcon Icon={Table2} size={14} c="var(--fg-secondary)" />
        <Text13Regular>{workbook?.name}</Text13Regular>
      </Group>

      <Group flex={1} justify="flex-end" gap="xs">
        {!chatOpen && (
          <ButtonSecondaryInline
            onClick={openChat}
            leftSection={<StyledLucideIcon Icon={MessagesSquareIcon} size="sm" />}
          >
            Chat
          </ButtonSecondaryInline>
        )}
        {connectToCLIButton}
        {pullButton}
        {publishButton}
        <WorkbookActionsMenu />
      </Group>

      {pullJobId && <PullProgressModal jobId={pullJobId} onClose={() => setPullJobId(null)} />}
      {workbook && (
        <ConnectToCLIModal workbookId={workbook.id} opened={cliModalOpened} onClose={() => setCliModalOpened(false)} />
      )}
    </Group>
  );
};
