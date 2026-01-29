import { Command } from '@/app/components/AdvancedAgentInput/CommandSuggestions';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { useMemo } from 'react';

// File agent specific commands hook

interface UseFileAgentCommandsOptions {
  setShowToolsModal: (show: boolean) => void;
}

export function useFileAgentCommands({ setShowToolsModal }: UseFileAgentCommandsOptions): Command[] {
  const { workbook } = useActiveWorkbook();
  const openPublishConfirmation = useWorkbookEditorUIStore((state) => state.openPublishConfirmation);

  return useMemo(() => {
    const commands: Command[] = [
      {
        id: 'cmd1',
        display: 'tools',
        description: 'Open tools modal',
        execute: () => setShowToolsModal(true),
      },
      {
        id: 'cmd2',
        display: 'publish',
        description: 'Publish data to remote service',
        execute: () => {
          if (!workbook) return;
          openPublishConfirmation();
        },
      },
    ];

    return commands;
  }, [setShowToolsModal, workbook, openPublishConfirmation]);
}
