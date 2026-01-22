'use client';

import { CornerBoxedBadge } from '@/app/components/CornerBoxedBadge';
import { ConnectorIcon } from '@/app/components/Icons/ConnectorIcon';
import { useAgentChatContext } from '@/app/workbooks/[...slug]/components/contexts/agent-chat-context';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useFileList } from '@/hooks/use-file-list';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { Text } from '@mantine/core';
import { Service } from '@spinner/shared-types';
import { FileTextIcon, FilesIcon, FolderIcon } from 'lucide-react';
import { useMemo } from 'react';

export const FileContextBadges = () => {
  const { includeActiveFile, setIncludeActiveFile, includeOpenFiles, setIncludeOpenFiles } = useAgentChatContext();

  const { workbook } = useActiveWorkbook();
  const { files } = useFileList(workbook?.id ?? null);

  const activeFileTabId = useWorkbookEditorUIStore((state) => state.activeFileTabId);
  const openFileTabs = useWorkbookEditorUIStore((state) => state.openFileTabs);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeTab = (openFileTabs as any[]).find((t) => t.id === activeFileTabId);

  const activeFileLabel = useMemo(() => {
    if (!activeTab) return 'No active file';
    const name = activeTab.title || activeTab.name || 'Untitled';
    return name.length > 20 ? `${name.slice(0, 20)}...` : name;
  }, [activeTab]);

  const activeIcon = useMemo(() => {
    if (!activeFileTabId || !files) {
      return <FileTextIcon size={12} style={{ opacity: includeActiveFile ? 1 : 0.5 }} />;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item = files.items.find((f: any) => f.id === activeFileTabId);

    if (item?.type === 'folder') {
      if (item.connectorService) {
        return (
          <ConnectorIcon
            connector={item.connectorService as Service}
            size={12}
            p={0}
            style={{ opacity: includeActiveFile ? 1 : 0.5 }}
          />
        );
      }
      return <FolderIcon size={12} style={{ opacity: includeActiveFile ? 1 : 0.5 }} />;
    }

    return <FileTextIcon size={12} style={{ opacity: includeActiveFile ? 1 : 0.5 }} />;
  }, [activeFileTabId, files, includeActiveFile]);

  const openFilesCount = openFileTabs.length;

  return (
    <>
      {activeTab && (
        <CornerBoxedBadge
          label={
            <Text
              fz="12px"
              lh={1}
              c={includeActiveFile ? 'gray.9' : 'gray.5'}
              td={includeActiveFile ? undefined : 'line-through'}
            >
              {activeFileLabel}
            </Text>
          }
          tooltip={includeActiveFile ? 'Include active file in context' : 'Active file excluded from context'}
          icon={activeIcon}
          onClick={() => setIncludeActiveFile(!includeActiveFile)}
        />
      )}

      {openFilesCount > 0 && (
        <CornerBoxedBadge
          label={
            <Text
              fz="12px"
              lh={1}
              c={includeOpenFiles ? 'gray.9' : 'gray.5'}
              td={includeOpenFiles ? undefined : 'line-through'}
            >
              {openFilesCount} open tab{openFilesCount !== 1 ? 's' : ''}
            </Text>
          }
          tooltip={includeOpenFiles ? 'Include open tabs in context' : 'Open tabs excluded from context'}
          icon={<FilesIcon size={12} style={{ opacity: includeOpenFiles ? 1 : 0.5 }} />}
          onClick={() => setIncludeOpenFiles(!includeOpenFiles)}
        />
      )}
    </>
  );
};
