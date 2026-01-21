import { Command } from '@/app/components/AdvancedAgentInput/CommandSuggestions';
import { useMemo } from 'react';

// File agent specific commands hook

interface UseFileAgentCommandsOptions {
  setShowToolsModal: (show: boolean) => void;
}

export function useFileAgentCommands({ setShowToolsModal }: UseFileAgentCommandsOptions): Command[] {
  return useMemo(() => {
    const commands: Command[] = [
      {
        id: 'cmd1',
        display: 'tools',
        description: 'Open tools modal',
        execute: () => setShowToolsModal(true),
      },
    ];

    return commands;
  }, [setShowToolsModal]);
}
