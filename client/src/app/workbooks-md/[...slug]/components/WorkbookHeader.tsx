import { ButtonSecondaryInline, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { Text13Regular } from '@/app/components/base/text';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { gettingStartedFlowUI } from '@/app/components/onboarding/getting-started/getting-started';
import { OnboardingFlowButton } from '@/app/components/onboarding/OnboardingFlowButton';
import { OnboardingStepContent } from '@/app/components/onboarding/OnboardingStepContent';
import { ToolIconButton } from '@/app/components/ToolIconButton';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useLayoutManagerStore } from '@/stores/layout-manager-store';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { Group } from '@mantine/core';
import { CloudUploadIcon, MessagesSquareIcon, PanelLeftIcon, Table2 } from 'lucide-react';
import { WorkbookActionsMenu } from './WorkbookActionsMenu';

export const WorkbookHeader = () => {
  const { workbook } = useActiveWorkbook();
  const toggleNavDrawer = useLayoutManagerStore((state) => state.toggleNavDrawer);
  const chatOpen = useWorkbookEditorUIStore((state) => state.chatOpen);
  const openChat = useWorkbookEditorUIStore((state) => state.openChat);
  const openDataFolderPublishConfirmation = useWorkbookEditorUIStore(
    (state) => state.openDataFolderPublishConfirmation,
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
        <OnboardingFlowButton />
        <OnboardingStepContent flow={gettingStartedFlowUI} stepKey="dataPublished" hide={true}>
          {publishButton}
        </OnboardingStepContent>

        <WorkbookActionsMenu />
      </Group>
    </Group>
  );
};
