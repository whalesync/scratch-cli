'use client';

import { ActionIconThreeDots } from '@/app/components/base/action-icons';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useFileList } from '@/hooks/use-file-list';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { RouteUrls } from '@/utils/route-urls';
import { Box, Button, Group, Menu, ScrollArea, Stack, Text } from '@mantine/core';
import type { FileWithPath } from '@mantine/dropzone';
import { DndProvider, getBackendOptions, MultiBackend, Tree, type NodeModel } from '@minoru/react-dnd-treeview';
import type { FileRefEntity } from '@spinner/shared-types';
import {
  BookOpenIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  InfoIcon,
  PlusIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './WorkbookFileBrowser.module.css';

interface WorkbookFileBrowserProps {
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
  isSelected: boolean;
  isDropTarget: boolean;
  onFileClick: (filePath: string) => void;
  onExternalFileDrop: (folderPath: string, files: FileWithPath[]) => void;
  onFolderDetailsClick: (folderPath: string) => void;
}

function TreeNodeRenderer({
  node,
  depth,
  isOpen,
  onToggle,
  isSelected,
  isDropTarget,
  onFileClick,
  onExternalFileDrop,
  onFolderDetailsClick,
}: TreeNodeRendererProps) {
  const nodeData = node.data;
  const [isExternalDragOver, setIsExternalDragOver] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [menuOpened, setMenuOpened] = useState(false);
  if (!nodeData) return <></>;

  const indent = depth * 18;
  const showDropHighlight = isDropTarget || isExternalDragOver;

  if (!nodeData.isFile) {
    // Folder node with native drag events for external file drops
    return (
      <Group
        gap="xs"
        h={24}
        pl={indent + 6}
        pr="xs"
        justify="space-between"
        onClick={onToggle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onDragOver={(e) => {
          // Only handle external file drags
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            e.stopPropagation();
            setIsExternalDragOver(true);
          }
        }}
        onDragEnter={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setIsExternalDragOver(true);
          }
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsExternalDragOver(false);
        }}
        onDrop={(e) => {
          if (e.dataTransfer.files.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            setIsExternalDragOver(false);
            // Convert FileList to FileWithPath[]
            const files = Array.from(e.dataTransfer.files) as FileWithPath[];
            onExternalFileDrop(nodeData.path, files);
          }
        }}
        style={{
          cursor: 'pointer',
          borderRadius: '4px',
          border: showDropHighlight ? '1px dashed var(--mantine-color-blue-5)' : '1px solid transparent',
          backgroundColor: showDropHighlight ? 'var(--mantine-color-blue-0)' : 'transparent',
        }}
      >
        <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
          {isOpen ? (
            <ChevronDownIcon size={14} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />
          ) : (
            <ChevronRightIcon size={14} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />
          )}
          <FolderIcon size={14} color={showDropHighlight ? 'var(--mantine-color-blue-5)' : 'var(--fg-secondary)'} />
          <Text size="sm" c={showDropHighlight ? 'var(--mantine-color-blue-7)' : 'var(--fg-secondary)'} truncate>
            {nodeData.name}
          </Text>
        </Group>
        {(isHovered || menuOpened) && (
          <Box
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <Menu opened={menuOpened} onChange={setMenuOpened} offset={0} withArrow={false} position="bottom-start">
              <Menu.Target>
                <ActionIconThreeDots />
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<InfoIcon size={16} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onFolderDetailsClick(nodeData.path);
                  }}
                >
                  View Details...
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Box>
        )}
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

export function WorkbookFileBrowser({}: WorkbookFileBrowserProps) {
  const router = useRouter();
  const { workbook } = useActiveWorkbook();
  const activeCells = useWorkbookEditorUIStore((state) => state.activeCells);
  const setActiveCells = useWorkbookEditorUIStore((state) => state.setActiveCells);
  const openFileTab = useWorkbookEditorUIStore((state) => state.openFileTab);
  const activeFileTabId = useWorkbookEditorUIStore((state) => state.activeFileTabId);
  const openFolderDetailsTab = useWorkbookEditorUIStore((state) => state.openFolderDetailsTab);

  // Use the file list hook
  const { files, isLoading } = useFileList(workbook?.id ?? null);

  // Local state for tree data (required for drag-and-drop to work)
  const [treeData, setTreeData] = useState<NodeModel<TreeNodeData>[]>([]);

  // Sync server data to local state
  useEffect(() => {
    if (files?.files) {
      setTreeData(files.files.map((f) => convertToTreeNode(f)));
    }
  }, [files]);

  const handleFileClick = (filePath: string) => {
    // Add to open tabs if not already open, and set as active
    openFileTab(filePath);

    // Update activeCells for compatibility
    setActiveCells({
      recordId: filePath,
      columnId: activeCells?.columnId,
      viewType: 'md',
    });
  };

  const handleDrop = (newTree: NodeModel<TreeNodeData>[]) => {
    console.log('DROP!', newTree);
    setTreeData(newTree);
    // TODO: Call API to persist the file move
  };

  const handleDragStart = (node: NodeModel<TreeNodeData>) => {
    console.log('DRAG START:', node);
  };

  const handleDragEnd = (node: NodeModel<TreeNodeData>) => {
    console.log('DRAG END:', node);
  };

  const handleExternalFileDrop = (folderPath: string, files: FileWithPath[]) => {
    console.log('EXTERNAL FILE DROP:', folderPath, files);
    // TODO: Upload files to the folder
  };

  const handleFolderDetailsClick = (folderPath: string) => {
    openFolderDetailsTab(folderPath);
  };

  // Debug: log tree data
  console.log('treeData:', treeData);

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
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    classes={{ listItem: styles.listItem }}
                    render={(node, { depth, isOpen, onToggle, isDropTarget }) => (
                      <TreeNodeRenderer
                        node={node}
                        depth={depth}
                        isOpen={isOpen}
                        onToggle={onToggle}
                        isSelected={activeFileTabId === node.data?.path}
                        isDropTarget={isDropTarget}
                        onFileClick={handleFileClick}
                        onExternalFileDrop={handleExternalFileDrop}
                        onFolderDetailsClick={handleFolderDetailsClick}
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
