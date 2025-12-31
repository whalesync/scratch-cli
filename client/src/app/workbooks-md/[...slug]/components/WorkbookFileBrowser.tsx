'use client';

import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useFileList } from '@/hooks/use-file-list';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { RouteUrls } from '@/utils/route-urls';
import { Box, Button, Group, ScrollArea, Stack, Text } from '@mantine/core';
import { DndProvider, getBackendOptions, MultiBackend, Tree, type NodeModel } from '@minoru/react-dnd-treeview';
import type { FileRefEntity } from '@spinner/shared-types';
import { BookOpenIcon, ChevronDownIcon, ChevronRightIcon, FileTextIcon, FolderIcon, PlusIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import styles from './WorkbookFileBrowser.module.css';

interface WorkbookFileBrowserProps {
  openTabs: string[];
  setOpenTabs: React.Dispatch<React.SetStateAction<string[]>>;
  activeTabId: string | null;
  setActiveTabId: React.Dispatch<React.SetStateAction<string | null>>;
  refreshWorkbook?: () => Promise<void>;
}

interface TreeNodeData {
  name: string;
  path: string;
  isFile: boolean;
}

interface TreeNodeRendererProps {
  node: NodeModel<TreeNodeData>;
  depth: number;
  isOpen: boolean;
  onToggle: () => void;
  activeTabId: string | null;
  onFileClick: (filePath: string) => void;
}

function TreeNodeRenderer({ node, depth, isOpen, onToggle, activeTabId, onFileClick }: TreeNodeRendererProps) {
  const nodeData = node.data;
  if (!nodeData) return <></>;

  const isSelected = activeTabId === nodeData.path;
  const indent = depth * 18;

  if (!nodeData.isFile) {
    // Folder node
    return (
      <Group
        gap="xs"
        h={24}
        pl={indent + 6}
        pr="xs"
        onClick={onToggle}
        style={{
          cursor: 'pointer',
          borderRadius: '4px',
        }}
        bg="transparent"
      >
        {isOpen ? (
          <ChevronDownIcon size={14} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />
        ) : (
          <ChevronRightIcon size={14} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />
        )}
        <FolderIcon size={14} color="var(--fg-secondary)" />
        <Text size="sm" c="var(--fg-secondary)" truncate>
          {nodeData.name}
        </Text>
      </Group>
    );
  } else {
    // File node
    return (
      <Group
        h={24}
        pl={indent + 6}
        pr="xs"
        gap="xs"
        onClick={() => onFileClick(nodeData.path)}
        bg={isSelected ? 'var(--bg-selected)' : 'transparent'}
        style={{
          cursor: 'pointer',
          borderRadius: '4px',
        }}
      >
        <Box w={14} style={{ flexShrink: 0 }} />
        <FileTextIcon size={12} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />
        <Text size="sm" truncate c={isSelected ? 'var(--fg-primary)' : 'var(--fg-secondary)'}>
          {nodeData.name}
        </Text>
      </Group>
    );
  }
}

// Convert file/folder tree to react-dnd-treeview format
function convertToTreeNode(entity: FileRefEntity): NodeModel<TreeNodeData> {
  if (entity.type === 'folder') {
    // Add folder node
    return {
      id: entity.path,
      parent: entity.parentPath,
      droppable: true,
      text: entity.name,
      data: {
        name: entity.name,
        path: entity.path,
        isFile: false,
      },
    };
  } else {
    // Add file node
    return {
      id: entity.path,
      parent: entity.parentPath,
      droppable: false,
      text: entity.name,
      data: {
        name: entity.name,
        path: entity.path,
        isFile: true,
      },
    };
  }
}

export function WorkbookFileBrowser({ setOpenTabs, activeTabId, setActiveTabId }: WorkbookFileBrowserProps) {
  const router = useRouter();
  const { workbook } = useActiveWorkbook();
  const activeCells = useWorkbookEditorUIStore((state) => state.activeCells);
  const setActiveCells = useWorkbookEditorUIStore((state) => state.setActiveCells);

  // Use the file list hook
  const { files, isLoading } = useFileList(workbook?.id ?? null);

  // Convert files to tree data format
  const treeData = useMemo(() => {
    if (!files?.files) return [];

    return files.files.map((f) => convertToTreeNode(f));
  }, [files]);

  const handleFileClick = (filePath: string) => {
    // Add to open tabs if not already open
    setOpenTabs((prev) => {
      if (!prev.includes(filePath)) {
        return [...prev, filePath];
      }
      return prev;
    });

    // Set as active tab
    setActiveTabId(filePath);

    // Update activeCells for compatibility
    setActiveCells({
      recordId: filePath,
      columnId: activeCells?.columnId,
      viewType: 'md',
    });
  };

  const handleDrop = () => {
    // Handle tree reordering if needed
    // For now, we'll just prevent modifications since the tree is read-only from the server
  };

  if (!workbook) {
    return null;
  }

  return (
    <DndProvider backend={MultiBackend} options={getBackendOptions()}>
      <Stack h="100%" gap={0} bg="var(--bg-base)" style={{ border: '0.5px solid var(--fg-divider)' }}>
        {/* Tree Header */}
        <Group h={36} px="xs" justify="space-between" style={{ borderBottom: '0.5px solid var(--fg-divider)' }}>
          <Text fw={500} size="sm">
            Explorer
          </Text>
          <Group gap={4}>
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              leftSection={<PlusIcon size={12} />}
              onClick={() => router.push(RouteUrls.workbooksPageUrl)}
            >
              WB
            </Button>
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              leftSection={<PlusIcon size={12} />}
              onClick={() => router.push(RouteUrls.workbookNewTabPageUrl(workbook.id))}
            >
              Table
            </Button>
          </Group>
        </Group>

        <ScrollArea style={{ flex: 1 }}>
          <Stack gap={0} p="xs">
            {/* Workbook Node (Top Level) */}
            <Box>
              <Group
                gap="xs"
                h={24}
                style={{
                  borderRadius: '4px',
                }}
                bg="transparent"
              >
                <BookOpenIcon size={14} color="var(--fg-secondary)" />
                <Text size="sm" fw={500} c="var(--fg-primary)" truncate>
                  {workbook.name || 'Untitled Workbook'}
                </Text>
              </Group>

              {/* Files and Folders */}
              <Box ml={6} style={{ borderLeft: '1px solid var(--fg-divider)' }}>
                {isLoading && (
                  <Box pl={18} py="xs">
                    <Text size="xs" c="dimmed">
                      Loading files...
                    </Text>
                  </Box>
                )}
                {!isLoading && treeData.length === 0 && (
                  <Box pl={18} py="xs">
                    <Text size="xs" c="dimmed">
                      No files
                    </Text>
                  </Box>
                )}
                {!isLoading && treeData.length > 0 && (
                  <Tree
                    tree={treeData}
                    rootId="/"
                    onDrop={handleDrop}
                    classes={{ listItem: styles.listItem }}
                    render={(node, { depth, isOpen, onToggle }) => (
                      <TreeNodeRenderer
                        node={node}
                        depth={depth}
                        isOpen={isOpen}
                        onToggle={onToggle}
                        activeTabId={activeTabId}
                        onFileClick={handleFileClick}
                      />
                    )}
                  />
                )}
              </Box>
            </Box>
          </Stack>
        </ScrollArea>
      </Stack>
    </DndProvider>
  );
}
