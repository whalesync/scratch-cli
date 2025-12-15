import { ButtonSecondaryInline, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { Text13Regular } from '@/app/components/base/text';
import { DeletedConnectionIcon } from '@/app/components/Icons/DeletedConnectionIcon';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { gettingStartedFlowUI } from '@/app/components/onboarding/getting-started/getting-started';
import { OnboardingFlowButton } from '@/app/components/onboarding/OnboardingFlowButton';
import { OnboardingStepContent } from '@/app/components/onboarding/OnboardingStepContent';
import { ToolIconButton } from '@/app/components/ToolIconButton';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useSnapshotTableRecords } from '@/hooks/use-snapshot-table-records';
import { useLayoutManagerStore } from '@/stores/layout-manager-store';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { hasAllConnectionsDeleted } from '@/types/server-entities/workbook';
import { Group } from '@mantine/core';
import { CloudUploadIcon, MessagesSquareIcon, PanelLeftIcon, Table2 } from 'lucide-react';
import { useMemo } from 'react';
import { WorkbookActionsMenu } from './WorkbookActionsMenu';

export const WorkbookHeader = () => {
  const { workbook, activeTable } = useActiveWorkbook();
  const toggleNavDrawer = useLayoutManagerStore((state) => state.toggleNavDrawer);
  const chatOpen = useWorkbookEditorUIStore((state) => state.chatOpen);
  const openChat = useWorkbookEditorUIStore((state) => state.openChat);
  const openPublishConfirmation = useWorkbookEditorUIStore((state) => state.openPublishConfirmation);
  const allConnectionsDeleted = hasAllConnectionsDeleted(workbook);
  // const { shouldShowStep } = useOnboarding();

  const { columnChangeTypes } = useSnapshotTableRecords({
    workbookId: workbook?.id ?? null,
    tableId: activeTable?.id ?? null,
  });

  // Check if there are any pending suggestions in any column
  const hasPendingSuggestions = useMemo(() => {
    return Object.values(columnChangeTypes).some((changes) => changes.suggestedAdditions || changes.suggestedDeletions);
  }, [columnChangeTypes]);

  const publishButton = (
    <ButtonSecondaryOutline
      disabled={allConnectionsDeleted}
      size="compact-xs"
      leftSection={allConnectionsDeleted ? <DeletedConnectionIcon decorative={false} /> : <CloudUploadIcon size={14} />}
      onClick={openPublishConfirmation}
    >
      Publish
    </ButtonSecondaryOutline>
  );

  return (
    <Group bg="var(--bg-panel)" h={36} justify="space-between" pos="relative" px="xs" gap="xs">
      <ToolIconButton icon={PanelLeftIcon} onClick={toggleNavDrawer} size="md" />

      {/* Float in the middle */}
      <Group gap={6}>
        <StyledLucideIcon Icon={Table2} size={14} c="var(--fg-secondary)" />
        <Text13Regular>{workbook?.name}</Text13Regular>
      </Group>
      <Group gap="xs">
        {!chatOpen && (
          <ButtonSecondaryInline
            onClick={openChat}
            leftSection={<StyledLucideIcon Icon={MessagesSquareIcon} size="sm" />}
          >
            Chat
          </ButtonSecondaryInline>
        )}
        <OnboardingFlowButton />
        <OnboardingStepContent flow={gettingStartedFlowUI} stepKey="dataPublished" hide={hasPendingSuggestions}>
          {publishButton}
        </OnboardingStepContent>

        <WorkbookActionsMenu />
      </Group>
    </Group>
  );
};
