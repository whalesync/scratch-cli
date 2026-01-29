import { useAgentChatContext } from '@/app/workbooks-md/[...slug]/components/contexts/agent-chat-context';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { SWR_KEYS } from '@/lib/api/keys';
import { useAgentChatWebSocketStore } from '@/stores/agent-chat-websocket-store';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { WebSocketMessage } from '@/types/agent-websocket';
import { useCallback, useEffect } from 'react';
import { useSWRConfig } from 'swr';

/**
 * Hook to listen for file agent messages and refresh file content/lists.
 * This separates the file refresh logic from the main UI component.
 */
export function useFileAgentUpdates() {
  const { agentType } = useAgentChatContext();
  const { workbook } = useActiveWorkbook();
  const activeFileTabId = useWorkbookEditorUIStore((state) => state.activeFileTabId);
  const addMessageHandler = useAgentChatWebSocketStore((state) => state.addMessageHandler);
  const { mutate } = useSWRConfig();

  const handleMessage = useCallback(
    async (message: WebSocketMessage) => {
      // Only react for the file agent
      if (agentType !== 'file') return;

      if (message.type === 'message_response' || message.type === 'agent_error') {
        if (workbook?.id) {
          // 1. Refresh the active file's detail to see new content
          if (activeFileTabId) {
            await mutate(SWR_KEYS.files.detail(workbook.id, activeFileTabId));
          }
          // 2. Refresh the file list to see new files/folders
          await mutate(SWR_KEYS.files.list(workbook.id));
        }
      }
    },
    [agentType, workbook?.id, activeFileTabId, mutate],
  );

  useEffect(() => {
    // Only register if we are in file mode
    if (agentType === 'file') {
      const cleanup = addMessageHandler(handleMessage);
      return cleanup;
    }
  }, [agentType, addMessageHandler, handleMessage]);
}
