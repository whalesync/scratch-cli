'use client';

import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useFileList } from '@/hooks/use-file-list';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { filesApi, foldersApi } from '@/lib/api/files';
import { workbookApi } from '@/lib/api/workbook';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { RouteUrls } from '@/utils/route-urls';
import { Box, Button, Group, Menu, Modal, ScrollArea, Stack, Text, TextInput } from '@mantine/core';
import type { FileWithPath } from '@mantine/dropzone';
import { DndProvider, DropOptions, getBackendOptions, MultiBackend, NodeModel, Tree } from '@minoru/react-dnd-treeview';
import type { FileId, FileOrFolderRefEntity, FolderId } from '@spinner/shared-types';
import {
  BookOpenIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DownloadIcon,
  FilePlusIcon,
  FileTextIcon,
  FolderIcon,
  FolderPlusIcon,
  InfoIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import styles from './WorkbookFileBrowser.module.css';

interface NodeInfoData {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
}

type InputModalType =
  | { type: 'createFolder'; parentFolderId: FolderId | null }
  | { type: 'createFile'; parentFolderId: FolderId | null }
  | { type: 'renameFolder'; folderId: FolderId; currentName: string }
  | { type: 'renameFile'; fileId: FileId; currentName: string };

interface WorkbookFileBrowserProps {
  refreshWorkbook?: () => Promise<void>;
}

interface TreeNodeData {
  id: string;
  name: string;
  parentFolderId: FolderId | null;
  isFile: boolean;
}

interface TreeNodeRendererProps {
  node: NodeModel<TreeNodeData>;
  depth: number;
  isOpen: boolean;
  onToggle: () => void;
  isSelected: boolean;
  isDropTarget: boolean;
  isAdmin: boolean;
  onFileClick: (fileId: FileId, fileName: string) => void;
  onExternalFileDrop: (folderId: FolderId | null, files: FileWithPath[]) => void;
  onFolderDetailsClick: (folderId: FolderId) => void;
  onFileRename: (fileId: FileId, currentName: string) => void;
  onFileDelete: (fileId: FileId) => void;
  onFileDownload: (fileId: FileId) => void;
  onFolderRename: (folderId: FolderId, currentName: string) => void;
  onFolderDelete: (folderId: FolderId) => void;
  onShowInfo: (info: NodeInfoData) => void;
  getNodePath: (nodeId: string) => string;
  onCreateFolderInFolder: (parentFolderId: FolderId) => void;
  onCreateFileInFolder: (parentFolderId: FolderId) => void;
}

function TreeNodeRenderer({
  node,
  depth,
  isOpen,
  onToggle,
  isSelected,
  isDropTarget,
  isAdmin,
  onFileClick,
  onExternalFileDrop,
  onFolderDetailsClick,
  onFileRename,
  onFileDelete,
  onFileDownload,
  onFolderRename,
  onFolderDelete,
  onShowInfo,
  getNodePath,
  onCreateFolderInFolder,
  onCreateFileInFolder,
}: TreeNodeRendererProps) {
  const nodeData = node.data;
  const [isExternalDragOver, setIsExternalDragOver] = useState(false);
  const [menuOpened, setMenuOpened] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  if (!nodeData) return <></>;

  const indent = depth * 18;
  const showDropHighlight = isDropTarget || isExternalDragOver;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setMenuOpened(true);
  };

  const handleShowInfo = () => {
    onShowInfo({
      id: nodeData.id,
      name: nodeData.name,
      path: getNodePath(nodeData.id),
      type: nodeData.isFile ? 'file' : 'folder',
    });
  };

  if (!nodeData.isFile) {
    // Folder node with native drag events for external file drops
    return (
      <>
        <Group
          gap="xs"
          h={24}
          pl={indent + 6}
          pr="xs"
          wrap="nowrap"
          onClick={onToggle}
          onContextMenu={handleContextMenu}
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
              onExternalFileDrop(nodeData.id as FolderId, files);
            }
          }}
          className={styles.treeNode}
          data-drop-target={showDropHighlight ? 'true' : 'false'}
          style={{
            cursor: 'pointer',
            borderRadius: '4px',
            border: showDropHighlight ? '1px dashed var(--mantine-color-blue-5)' : '1px solid transparent',
            backgroundColor: showDropHighlight ? 'var(--mantine-color-blue-0)' : 'transparent',
          }}
        >
          {isOpen ? (
            <ChevronDownIcon size={14} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />
          ) : (
            <ChevronRightIcon size={14} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />
          )}
          <FolderIcon
            size={14}
            color={showDropHighlight ? 'var(--mantine-color-blue-5)' : 'var(--fg-secondary)'}
            style={{ flexShrink: 0 }}
          />
          <Text
            size="sm"
            c={showDropHighlight ? 'var(--mantine-color-blue-7)' : 'var(--fg-secondary)'}
            truncate
            style={{ flex: 1, minWidth: 0 }}
          >
            {nodeData.name}
          </Text>
        </Group>
        <Menu opened={menuOpened} onChange={setMenuOpened} position="bottom-start" withinPortal>
          <Menu.Target>
            <Box style={{ position: 'fixed', top: menuPosition.y, left: menuPosition.x, width: 0, height: 0 }} />
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<FilePlusIcon size={16} />}
              onClick={(e) => {
                e.stopPropagation();
                onCreateFileInFolder(nodeData.id as FolderId);
              }}
            >
              New File
            </Menu.Item>
            <Menu.Item
              leftSection={<FolderPlusIcon size={16} />}
              onClick={(e) => {
                e.stopPropagation();
                onCreateFolderInFolder(nodeData.id as FolderId);
              }}
            >
              New Folder
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
              leftSection={<InfoIcon size={16} />}
              onClick={(e) => {
                e.stopPropagation();
                onFolderDetailsClick(nodeData.id as FolderId);
              }}
            >
              View Details...
            </Menu.Item>
            <Menu.Item
              leftSection={<PencilIcon size={16} />}
              onClick={(e) => {
                e.stopPropagation();
                onFolderRename(nodeData.id as FolderId, nodeData.name);
              }}
            >
              Rename
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
              leftSection={<Trash2Icon size={16} />}
              color="red"
              onClick={(e) => {
                e.stopPropagation();
                onFolderDelete(nodeData.id as FolderId);
              }}
            >
              Delete
            </Menu.Item>
            {isAdmin && (
              <>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<InfoIcon size={16} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShowInfo();
                  }}
                >
                  Show Info
                </Menu.Item>
              </>
            )}
          </Menu.Dropdown>
        </Menu>
      </>
    );
  } else {
    // File node
    return (
      <>
        <Group
          h={24}
          pl={indent + 6}
          pr="xs"
          gap="xs"
          wrap="nowrap"
          onClick={() => onFileClick(nodeData.id as FileId, nodeData.name)}
          onContextMenu={handleContextMenu}
          bg={isSelected ? 'var(--bg-selected)' : 'transparent'}
          className={styles.treeNode}
          data-selected={isSelected ? 'true' : 'false'}
          style={{
            cursor: 'pointer',
            borderRadius: '4px',
          }}
        >
          <Box w={14} style={{ flexShrink: 0 }} />
          <FileTextIcon size={12} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />
          <Text
            size="sm"
            c={isSelected ? 'var(--fg-primary)' : 'var(--fg-secondary)'}
            truncate
            style={{ flex: 1, minWidth: 0 }}
          >
            {nodeData.name}
          </Text>
        </Group>
        <Menu opened={menuOpened} onChange={setMenuOpened} position="bottom-start" withinPortal>
          <Menu.Target>
            <Box style={{ position: 'fixed', top: menuPosition.y, left: menuPosition.x, width: 0, height: 0 }} />
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<DownloadIcon size={16} />}
              onClick={(e) => {
                e.stopPropagation();
                onFileDownload(nodeData.id as FileId);
              }}
            >
              Download
            </Menu.Item>
            <Menu.Item
              leftSection={<PencilIcon size={16} />}
              onClick={(e) => {
                e.stopPropagation();
                onFileRename(nodeData.id as FileId, nodeData.name);
              }}
            >
              Rename
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
              leftSection={<Trash2Icon size={16} />}
              color="red"
              onClick={(e) => {
                e.stopPropagation();
                onFileDelete(nodeData.id as FileId);
              }}
            >
              Delete
            </Menu.Item>
            {isAdmin && (
              <>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<InfoIcon size={16} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShowInfo();
                  }}
                >
                  Show Info
                </Menu.Item>
              </>
            )}
          </Menu.Dropdown>
        </Menu>
      </>
    );
  }
}

// Convert file/folder entity to react-dnd-treeview format
function convertToTreeNode(entity: FileOrFolderRefEntity): NodeModel<TreeNodeData> {
  if (entity.type === 'folder') {
    // Folder node
    return {
      id: entity.id,
      parent: entity.parentFolderId ?? 0, // 0 represents root
      droppable: true,
      text: entity.name,
      data: {
        id: entity.id,
        name: entity.name,
        parentFolderId: entity.parentFolderId,
        isFile: false,
      },
    };
  } else {
    // File node
    return {
      id: entity.id,
      parent: entity.parentFolderId ?? 0, // 0 represents root
      droppable: false,
      text: entity.name,
      data: {
        id: entity.id,
        name: entity.name,
        parentFolderId: entity.parentFolderId,
        isFile: true,
      },
    };
  }
}

export function WorkbookFileBrowser({}: WorkbookFileBrowserProps) {
  const router = useRouter();
  const { workbook } = useActiveWorkbook();
  const { isAdmin } = useScratchPadUser();
  const activeCells = useWorkbookEditorUIStore((state) => state.activeCells);
  const setActiveCells = useWorkbookEditorUIStore((state) => state.setActiveCells);
  const openFileTab = useWorkbookEditorUIStore((state) => state.openFileTab);
  const activeFileTabId = useWorkbookEditorUIStore((state) => state.activeFileTabId);

  // Use the file list hook
  const { files, isLoading, refreshFiles } = useFileList(workbook?.id ?? null);

  // Local state for tree data (required for drag-and-drop to work)
  const [treeData, setTreeData] = useState<NodeModel<TreeNodeData>[]>([]);

  // State for info modal
  const [infoModalData, setInfoModalData] = useState<NodeInfoData | null>(null);

  // State for input modal (create/rename)
  const [inputModal, setInputModal] = useState<InputModalType | null>(null);
  const [inputValue, setInputValue] = useState('');

  // Sync server data to local state
  useEffect(() => {
    if (files?.items) {
      setTreeData(files.items.map((f) => convertToTreeNode(f)));
    }
  }, [files]);

  // Build path for a node by traversing up the tree
  const getNodePath = useCallback(
    (nodeId: string): string => {
      const buildPath = (id: string, path: string[] = []): string[] => {
        const node = treeData.find((n) => n.id === id);
        if (!node) return path;

        path.unshift(node.data?.name || '');

        if (node.parent && node.parent !== 0) {
          return buildPath(node.parent as string, path);
        }
        return path;
      };

      return '/' + buildPath(nodeId).join('/');
    },
    [treeData],
  );

  const handleShowInfo = useCallback((info: NodeInfoData) => {
    setInfoModalData(info);
  }, []);

  const handleFileClick = (fileId: FileId, fileName: string) => {
    // Add to open tabs if not already open, and set as active
    openFileTab({ id: fileId, type: 'file', title: fileName });

    // Update activeCells for compatibility
    setActiveCells({
      recordId: fileId,
      columnId: activeCells?.columnId,
      viewType: 'md',
    });
  };

  const handleDrop = async (newTree: NodeModel<TreeNodeData>[], options: DropOptions<TreeNodeData>) => {
    console.log('DROP!', newTree);
    setTreeData(newTree);

    const { dragSourceId, dropTargetId } = options;
    const draggedNode = newTree.find((n) => n.id === dragSourceId);

    if (!draggedNode || !workbook) return;

    // Convert dropTargetId (which can be string or number 0) to our nullable parentId format
    const newParentId = dropTargetId === 0 ? null : (dropTargetId as string);

    if (draggedNode.data?.isFile === false) {
      // It's a folder
      try {
        await workbookApi.moveFolder(workbook.id, dragSourceId as string, newParentId);
      } catch (error) {
        console.error('Failed to move folder:', error);
        // Refresh to revert changes if failed
        await refreshFiles();
      }
    } else {
      // TODO: Handle file move API if needed
      // For now just console log
      console.log('Moved file', dragSourceId, 'to parent', newParentId);
    }
  };

  const handleDragStart = (node: NodeModel<TreeNodeData>) => {
    console.log('DRAG START:', node);
  };

  const handleDragEnd = (node: NodeModel<TreeNodeData>) => {
    console.log('DRAG END:', node);
  };

  const handleExternalFileDrop = (folderId: FolderId | null, droppedFiles: FileWithPath[]) => {
    console.log('EXTERNAL FILE DROP:', folderId, droppedFiles);
    // TODO: Upload files to the folder
  };

  const handleFolderDetailsClick = (folderId: FolderId) => {
    openFileTab({ id: folderId, type: 'folder', title: 'Folder' }); // Or get folder name
  };

  const handleFileRename = useCallback((fileId: FileId, currentName: string) => {
    setInputModal({ type: 'renameFile', fileId, currentName });
    setInputValue(currentName);
  }, []);

  const handleFileDelete = useCallback(
    async (fileId: FileId) => {
      if (!workbook) return;
      if (!window.confirm('Are you sure you want to delete this file?')) return;

      try {
        await filesApi.deleteFile(workbook.id, fileId);
        await refreshFiles();
      } catch (error) {
        console.error('Failed to delete file:', error);
      }
    },
    [workbook, refreshFiles],
  );

  const handleFileDownload = useCallback(
    (fileId: FileId) => {
      if (!workbook) return;
      foldersApi.downloadFile(workbook.id, fileId);
    },
    [workbook],
  );

  const handleFolderRename = useCallback((folderId: FolderId, currentName: string) => {
    setInputModal({ type: 'renameFolder', folderId, currentName });
    setInputValue(currentName);
  }, []);

  const handleFolderDelete = useCallback(
    async (folderId: FolderId) => {
      if (!workbook) return;
      if (!window.confirm('Are you sure you want to delete this folder and all its contents?')) return;

      try {
        await foldersApi.deleteFolder(workbook.id, folderId);
        await refreshFiles();
      } catch (error) {
        console.error('Failed to delete folder:', error);
      }
    },
    [workbook, refreshFiles],
  );

  const handleCreateFolder = useCallback((parentFolderId: FolderId | null = null) => {
    setInputModal({ type: 'createFolder', parentFolderId });
    setInputValue('');
  }, []);

  const handleCreateFile = useCallback((parentFolderId: FolderId | null = null) => {
    setInputModal({ type: 'createFile', parentFolderId });
    setInputValue('');
  }, []);

  const handleCreateFolderInFolder = useCallback(
    (parentFolderId: FolderId) => {
      handleCreateFolder(parentFolderId);
    },
    [handleCreateFolder],
  );

  const handleCreateFileInFolder = useCallback(
    (parentFolderId: FolderId) => {
      handleCreateFile(parentFolderId);
    },
    [handleCreateFile],
  );

  const handleInputModalSubmit = useCallback(async () => {
    if (!workbook || !inputModal || !inputValue.trim()) return;

    try {
      switch (inputModal.type) {
        case 'createFolder':
          await foldersApi.createFolder(workbook.id, {
            name: inputValue.trim(),
            parentFolderId: inputModal.parentFolderId,
          });
          break;
        case 'createFile':
          await filesApi.createFile(workbook.id, {
            name: inputValue.trim(),
            parentFolderId: inputModal.parentFolderId,
          });
          break;
        case 'renameFolder':
          await foldersApi.renameFolder(workbook.id, inputModal.folderId, inputValue.trim());
          break;
        case 'renameFile':
          await filesApi.updateFile(workbook.id, inputModal.fileId, { name: inputValue.trim() });
          break;
      }
      await refreshFiles();
      setInputModal(null);
      setInputValue('');
    } catch (error) {
      console.error('Failed to complete operation:', error);
    }
  }, [workbook, inputModal, inputValue, refreshFiles]);

  const getInputModalTitle = () => {
    if (!inputModal) return '';
    switch (inputModal.type) {
      case 'createFolder':
        return 'New Folder';
      case 'createFile':
        return 'New File';
      case 'renameFolder':
        return 'Rename Folder';
      case 'renameFile':
        return 'Rename File';
    }
  };

  const getInputModalPlaceholder = () => {
    if (!inputModal) return '';
    switch (inputModal.type) {
      case 'createFolder':
      case 'renameFolder':
        return 'Folder name';
      case 'createFile':
      case 'renameFile':
        return 'File name';
    }
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
              leftSection={<FolderPlusIcon size={12} />}
              onClick={() => handleCreateFolder(null)}
            >
              Folder
            </Button>
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
                    rootId={0}
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
                        isSelected={activeFileTabId === node.data?.id}
                        isDropTarget={isDropTarget}
                        isAdmin={!!isAdmin}
                        onFileClick={handleFileClick}
                        onExternalFileDrop={handleExternalFileDrop}
                        onFolderDetailsClick={handleFolderDetailsClick}
                        onFileRename={handleFileRename}
                        onFileDelete={handleFileDelete}
                        onFileDownload={handleFileDownload}
                        onFolderRename={handleFolderRename}
                        onFolderDelete={handleFolderDelete}
                        onShowInfo={handleShowInfo}
                        getNodePath={getNodePath}
                        onCreateFolderInFolder={handleCreateFolderInFolder}
                        onCreateFileInFolder={handleCreateFileInFolder}
                      />
                    )}
                  />
                )}
              </Box>
            </Box>
          </Stack>
        </ScrollArea>
      </Stack>

      {/* Info Modal (Admin only) */}
      <Modal
        opened={!!infoModalData}
        onClose={() => setInfoModalData(null)}
        title={`${infoModalData?.type === 'folder' ? 'Folder' : 'File'} Info`}
        size="md"
      >
        {infoModalData && (
          <Stack gap="sm">
            <Group>
              <Text fw={500} size="sm" w={60}>
                ID:
              </Text>
              <Text size="sm" c="dimmed" style={{ fontFamily: 'monospace' }}>
                {infoModalData.id}
              </Text>
            </Group>
            <Group>
              <Text fw={500} size="sm" w={60}>
                Name:
              </Text>
              <Text size="sm">{infoModalData.name}</Text>
            </Group>
            <Group>
              <Text fw={500} size="sm" w={60}>
                Path:
              </Text>
              <Text size="sm" c="dimmed" style={{ fontFamily: 'monospace' }}>
                {infoModalData.path}
              </Text>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Input Modal (Create/Rename) */}
      <Modal
        opened={!!inputModal}
        onClose={() => {
          setInputModal(null);
          setInputValue('');
        }}
        title={getInputModalTitle()}
        size="sm"
      >
        <Stack gap="md">
          <TextInput
            placeholder={getInputModalPlaceholder()}
            value={inputValue}
            onChange={(e) => setInputValue(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleInputModalSubmit();
              }
            }}
            autoFocus
          />
          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              color="gray"
              onClick={() => {
                setInputModal(null);
                setInputValue('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleInputModalSubmit} disabled={!inputValue.trim()}>
              {inputModal?.type.startsWith('create') ? 'Create' : 'Rename'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </DndProvider>
  );
}
