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
  CopyIcon,
  DownloadIcon,
  FilePlusIcon,
  FileTextIcon,
  FolderIcon,
  FolderInputIcon,
  FolderPlusIcon,
  InfoIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { FolderPickerModal } from './FolderPickerModal';
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
  | { type: 'renameFile'; fileId: FileId; currentName: string }
  | { type: 'duplicateFile'; fileId: FileId; parentFolderId: FolderId | null; currentName: string };

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
  onNodeSelect: (
    nodeId: string,
    modifiers: { shift: boolean; ctrl: boolean; meta: boolean },
    shouldOpen?: boolean,
  ) => void;
  onFileDoubleClick: (fileId: FileId, fileName: string) => void;
  onExternalFileDrop: (folderId: FolderId | null, files: FileWithPath[]) => void;
  onFolderDetailsClick: (folderId: FolderId) => void;
  onFileRename: (fileId: FileId, currentName: string) => void;
  onFileDelete: (fileId: FileId) => void;
  onFileDownload: (fileId: FileId) => void;
  onFileCopy: (fileId: FileId) => void;
  onFileMove: (fileId: FileId) => void;
  onFileDuplicate: (fileId: FileId, parentFolderId: FolderId | null, currentName: string) => void;
  onFolderRename: (folderId: FolderId, currentName: string) => void;
  onFolderDelete: (folderId: FolderId) => void;
  onFolderDownload: (folderId: FolderId) => void;
  onShowInfo: (info: NodeInfoData) => void;
  getNodePath: (nodeId: string) => string;
  onCreateFolderInFolder: (parentFolderId: FolderId) => void;
  onCreateFileInFolder: (parentFolderId: FolderId) => void;
  selectedCount: number;
  areAllSelectedFiles: boolean;
  onBulkDelete: () => void;
  onBulkMove: () => void;
}

function TreeNodeRenderer({
  node,
  depth,
  isOpen,
  onToggle,
  isSelected,
  isDropTarget,
  isAdmin,
  onNodeSelect,
  onFileDoubleClick,
  onExternalFileDrop,
  onFolderDetailsClick,
  onFileRename,
  onFileDelete,
  onFileDownload,
  onFileCopy,
  onFileMove,
  onFileDuplicate,
  onFolderRename,
  onFolderDelete,
  onFolderDownload,
  onShowInfo,
  getNodePath,
  onCreateFolderInFolder,
  onCreateFileInFolder,
  selectedCount,
  areAllSelectedFiles,
  onBulkDelete,
  onBulkMove,
}: TreeNodeRendererProps) {
  const nodeData = node.data;
  const [isExternalDragOver, setIsExternalDragOver] = useState(false);
  const [menuOpened, setMenuOpened] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  if (!nodeData) return <></>;

  const indent = depth * 18;
  const showDropHighlight = isDropTarget || isExternalDragOver;
  const canShowContextMenu = isSelected;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // If not selected, select it first (without opening)
    if (!isSelected) {
      onNodeSelect(nodeData.id, { shift: false, ctrl: false, meta: false }, false);
    }

    setMenuPosition({ x: e.clientX, y: e.clientY });
    setMenuOpened(true);
  };

  const handleNodeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // For folders, clicking the chevron area should still toggle
    // For files, clicking anywhere selects
    const modifiers = {
      shift: e.shiftKey,
      ctrl: e.ctrlKey,
      meta: e.metaKey,
    };
    if (nodeData.isFile) {
      onNodeSelect(nodeData.id, modifiers);
    } else {
      // For folders, clicking the text area selects, clicking chevron toggles
      const target = e.target as HTMLElement;
      if (target.closest('[data-chevron]')) {
        // Chevron click handled separately, don't select
        return;
      } else {
        onNodeSelect(nodeData.id, modifiers);
      }
    }
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle();
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
          onClick={handleNodeClick}
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
          data-selected={isSelected ? 'true' : 'false'}
          bg={isSelected ? 'var(--bg-selected)' : showDropHighlight ? 'var(--mantine-color-blue-0)' : 'transparent'}
          style={{
            cursor: 'pointer',
            borderRadius: '4px',
            border: showDropHighlight ? '1px dashed var(--mantine-color-blue-5)' : '1px solid transparent',
          }}
        >
          <Box
            data-chevron
            onClick={handleChevronClick}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            {isOpen ? (
              <ChevronDownIcon size={14} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />
            ) : (
              <ChevronRightIcon size={14} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />
            )}
          </Box>
          <FolderIcon
            size={14}
            color={showDropHighlight ? 'var(--mantine-color-blue-5)' : 'var(--fg-secondary)'}
            style={{ flexShrink: 0 }}
          />
          <Text
            size="sm"
            c={
              showDropHighlight
                ? 'var(--mantine-color-blue-7)'
                : isSelected
                  ? 'var(--fg-primary)'
                  : 'var(--fg-secondary)'
            }
            truncate
            style={{ flex: 1, minWidth: 0 }}
          >
            {nodeData.name}
          </Text>
        </Group>
        {canShowContextMenu && (
          <Menu opened={menuOpened} onChange={setMenuOpened} position="bottom-start" withinPortal>
            <Menu.Target>
              <Box style={{ position: 'fixed', top: menuPosition.y, left: menuPosition.x, width: 0, height: 0 }} />
            </Menu.Target>
            <Menu.Dropdown>
              {selectedCount > 1 ? (
                <>
                  <Menu.Item
                    leftSection={<Trash2Icon size={16} />}
                    color="red"
                    onClick={(e) => {
                      e.stopPropagation();
                      onBulkDelete();
                    }}
                  >
                    Delete {selectedCount} items
                  </Menu.Item>
                </>
              ) : (
                <>
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
                  <Menu.Item
                    leftSection={<DownloadIcon size={16} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFolderDownload(nodeData.id as FolderId);
                    }}
                  >
                    Download
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
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        )}
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
          onClick={handleNodeClick}
          onDoubleClick={() => onFileDoubleClick(nodeData.id as FileId, nodeData.name)}
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
        {canShowContextMenu && (
          <Menu opened={menuOpened} onChange={setMenuOpened} position="bottom-start" withinPortal>
            <Menu.Target>
              <Box style={{ position: 'fixed', top: menuPosition.y, left: menuPosition.x, width: 0, height: 0 }} />
            </Menu.Target>
            <Menu.Dropdown>
              {selectedCount > 1 ? (
                <>
                  {areAllSelectedFiles && (
                    <Menu.Item
                      leftSection={<FolderInputIcon size={16} />}
                      onClick={(e) => {
                        e.stopPropagation();
                        onBulkMove();
                      }}
                    >
                      Move {selectedCount} items
                    </Menu.Item>
                  )}
                  <Menu.Item
                    leftSection={<Trash2Icon size={16} />}
                    color="red"
                    onClick={(e) => {
                      e.stopPropagation();
                      onBulkDelete();
                    }}
                  >
                    Delete {selectedCount} items
                  </Menu.Item>
                </>
              ) : (
                <>
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
                  <Menu.Item
                    leftSection={<CopyIcon size={16} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileDuplicate(nodeData.id as FileId, nodeData.parentFolderId, nodeData.name);
                    }}
                  >
                    Duplicate
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    leftSection={<CopyIcon size={16} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileCopy(nodeData.id as FileId);
                    }}
                  >
                    Copy to...
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<FolderInputIcon size={16} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFileMove(nodeData.id as FileId);
                    }}
                  >
                    Move to...
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
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        )}
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

  // Use the file list hook
  const { files, isLoading, refreshFiles } = useFileList(workbook?.id ?? null);

  // Local state for tree data (required for drag-and-drop to work)
  const [treeData, setTreeData] = useState<NodeModel<TreeNodeData>[]>([]);

  // State for selected nodes (multiple selection)
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  // Anchor node for range selection (shift-click)
  const [lastSelectedNodeId, setLastSelectedNodeId] = useState<string | null>(null);

  // State for info modal
  const [infoModalData, setInfoModalData] = useState<NodeInfoData | null>(null);

  // State for input modal (create/rename)
  const [inputModal, setInputModal] = useState<InputModalType | null>(null);
  const [inputValue, setInputValue] = useState('');

  // State for copy file modal
  const [copyFileId, setCopyFileId] = useState<FileId | null>(null);

  // State for move file modal
  const [moveFileIds, setMoveFileIds] = useState<FileId[] | null>(null);

  // Sync server data to local state
  useEffect(() => {
    if (files?.items) {
      setTreeData(files.items.map((f) => convertToTreeNode(f)));
    }
  }, [files]);

  // Clear selection when files refresh
  useEffect(() => {
    setSelectedNodes(new Set());
    setLastSelectedNodeId(null);
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

  const handleSingleSelect = useCallback(
    (nodeId: string, shouldOpen: boolean = true) => {
      setSelectedNodes(new Set([nodeId]));
      setLastSelectedNodeId(nodeId);

      if (!shouldOpen) return;

      // Also open if it's a file
      const node = treeData.find((n) => n.id === nodeId);
      if (node?.data?.isFile) {
        openFileTab({ id: nodeId as FileId, type: 'file', title: node.data.name });

        // Also set active cells for compatibility
        setActiveCells({
          recordId: nodeId,
          columnId: activeCells?.columnId,
          viewType: 'md',
        });
      }
    },
    [treeData, openFileTab, setActiveCells, activeCells],
  );

  const handleNodeSelect = useCallback(
    (nodeId: string, modifiers: { shift: boolean; ctrl: boolean; meta: boolean }, shouldOpen: boolean = true) => {
      const isMultiSelect = modifiers.ctrl || modifiers.meta;
      const isRangeSelect = modifiers.shift;

      const targetNode = treeData.find((n) => n.id === nodeId);
      if (!targetNode) return;

      // Ensure we are operating within the same context (same parent, roughly same type if needed)
      // The user requested: "shift and control click for files within the same folder only"
      // "once a click is done on an entity of different type or different parent treat it as a select of that entity only"

      // We need to check against the "anchor" or the existing selection set.
      // For simplicity, let's check against the anchor (lastSelectedNodeId) if it exists.
      const anchorNode = lastSelectedNodeId ? treeData.find((n) => n.id === lastSelectedNodeId) : null;

      const isSameParent = anchorNode && anchorNode.parent === targetNode.parent;
      const isSameType = anchorNode && anchorNode.data?.isFile === targetNode.data?.isFile;

      // If we are trying to multi-select but the criteria don't match, fall back to single select
      if ((isMultiSelect || isRangeSelect) && (!isSameParent || !isSameType)) {
        // Reset to single select of the new target
        handleSingleSelect(nodeId, shouldOpen);
        return;
      }

      if (isRangeSelect && lastSelectedNodeId && treeData.length > 0) {
        // Range select (Shift+Click)
        const startIndex = treeData.findIndex((n) => n.id === lastSelectedNodeId);
        const endIndex = treeData.findIndex((n) => n.id === nodeId);

        if (startIndex !== -1 && endIndex !== -1) {
          const [start, end] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
          // Filter range to only include items with the same parent
          const rangeIds = treeData
            .slice(start, end + 1)
            .filter((n) => n.parent === targetNode.parent && n.data?.isFile === targetNode.data?.isFile)
            .map((n) => n.id as string);

          setSelectedNodes(new Set(rangeIds));
        }
      } else if (isMultiSelect) {
        // Toggle select (Ctrl/Cmd+Click)
        setSelectedNodes((prev) => {
          const next = new Set(prev);
          if (next.has(nodeId)) {
            next.delete(nodeId);
          } else {
            next.add(nodeId);
          }
          return next;
        });
        // Update anchor to the latest clicked node
        setLastSelectedNodeId(nodeId);
      } else {
        handleSingleSelect(nodeId, shouldOpen);
      }
    },
    [treeData, lastSelectedNodeId, handleSingleSelect],
  );

  const handleFileDoubleClick = useCallback(
    (fileId: FileId, fileName: string) => {
      // Add to open tabs if not already open, and set as active
      openFileTab({ id: fileId, type: 'file', title: fileName });

      // Update activeCells for compatibility
      setActiveCells({
        recordId: fileId,
        columnId: activeCells?.columnId,
        viewType: 'md',
      });
    },
    [openFileTab, setActiveCells, activeCells],
  );

  const handleDrop = async (newTree: NodeModel<TreeNodeData>[], options: DropOptions<TreeNodeData>) => {
    const { dragSourceId, dropTargetId } = options;
    const draggedNode = treeData.find((n) => n.id === dragSourceId);

    if (!draggedNode || !workbook) return;

    // Determine nodes to move
    // If the dragged node is part of the selection, move all selected nodes
    // Otherwise, move only the dragged node
    let nodesToMoveIds: string[] = [];
    if (selectedNodes.has(dragSourceId as string)) {
      nodesToMoveIds = Array.from(selectedNodes);
    } else {
      nodesToMoveIds = [dragSourceId as string];
    }

    // Filter out the drop target itself to prevent moving a folder into itself
    nodesToMoveIds = nodesToMoveIds.filter((id) => id !== dropTargetId);

    if (nodesToMoveIds.length === 0) return;

    // Convert dropTargetId (which can be string or number 0) to our nullable parentId format
    const newParentId = dropTargetId === 0 ? null : (dropTargetId as FolderId);

    // Optimistically update treeData for ALL moved nodes
    const nextTree = treeData.map((node) => {
      if (nodesToMoveIds.includes(node.id as string)) {
        return {
          ...node,
          parent: dropTargetId,
          data: {
            ...node.data!,
            parentFolderId: newParentId,
          },
        };
      }
      return node;
    });

    setTreeData(nextTree);

    // Perform API calls
    try {
      const promises = nodesToMoveIds.map(async (id) => {
        const node = treeData.find((n) => n.id === id);
        if (!node) return;

        if (node.data?.isFile) {
          await filesApi.updateFile(workbook.id, id as FileId, { parentFolderId: newParentId });
        } else {
          await workbookApi.moveFolder(workbook.id, id as string, newParentId);
        }
      });

      await Promise.all(promises);
      await refreshFiles();
    } catch (error) {
      console.error('Failed to move items:', error);
      await refreshFiles();
    }
  };

  const handleDragStart = (node: NodeModel<TreeNodeData>) => {
    console.log('DRAG START:', node);
  };

  const handleDragEnd = (node: NodeModel<TreeNodeData>) => {
    console.log('DRAG END:', node);
  };

  const handleExternalFileDrop = useCallback(
    async (folderId: FolderId | null, droppedFiles: FileWithPath[]) => {
      if (!workbook) return;

      try {
        const promises = droppedFiles.map(async (file) => {
          const content = await file.text();
          await filesApi.createFile(workbook.id, {
            name: file.name,
            parentFolderId: folderId,
            content: content,
          });
        });

        await Promise.all(promises);
        await refreshFiles();
      } catch (error) {
        console.error('Failed to upload files:', error);
      }
    },
    [workbook, refreshFiles],
  );

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

  const handleFileCopy = useCallback((fileId: FileId) => {
    setCopyFileId(fileId);
  }, []);

  const handleFileCopyConfirm = useCallback(
    async (targetFolderId: FolderId | null) => {
      if (!workbook || !copyFileId) return;

      try {
        await filesApi.copyFile(workbook.id, copyFileId, targetFolderId);
        await refreshFiles();
        setCopyFileId(null);
      } catch (error) {
        console.error('Failed to copy file:', error);
      }
    },
    [workbook, copyFileId, refreshFiles],
  );

  const handleFileMove = useCallback((fileId: FileId) => {
    setMoveFileIds([fileId]);
  }, []);

  const handleBulkMove = useCallback(() => {
    // Filter out folders just in case, though UI should prevent it
    const fileIds = Array.from(selectedNodes).filter((id) => {
      const node = treeData.find((n) => n.id === id);
      return node?.data?.isFile;
    }) as FileId[];

    if (fileIds.length > 0) {
      setMoveFileIds(fileIds);
    }
  }, [selectedNodes, treeData]);

  const handleFileMoveConfirm = useCallback(
    async (targetFolderId: FolderId | null) => {
      if (!workbook || !moveFileIds) return;

      try {
        const promises = moveFileIds.map((id) =>
          filesApi.updateFile(workbook.id, id, { parentFolderId: targetFolderId }),
        );
        await Promise.all(promises);
        await refreshFiles();
        setMoveFileIds(null);
      } catch (error) {
        console.error('Failed to move files:', error);
      }
    },
    [workbook, moveFileIds, refreshFiles],
  );

  const handleBulkDelete = useCallback(async () => {
    if (!workbook || selectedNodes.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedNodes.size} items?`)) return;

    try {
      const promises = Array.from(selectedNodes).map(async (id) => {
        const node = treeData.find((n) => n.id === id);
        if (!node) return;
        if (node.data?.isFile) {
          await filesApi.deleteFile(workbook.id, id as FileId);
        } else {
          await foldersApi.deleteFolder(workbook.id, id as FolderId);
        }
      });
      await Promise.all(promises);
      await refreshFiles();
    } catch (error) {
      console.error('Failed to delete items:', error);
    }
  }, [workbook, selectedNodes, treeData, refreshFiles]);

  const handleFileDuplicate = useCallback((fileId: FileId, parentFolderId: FolderId | null, currentName: string) => {
    // Generate default duplicate name
    const ext = currentName.lastIndexOf('.');
    let duplicateName: string;
    if (ext > 0) {
      duplicateName = currentName.slice(0, ext) + ' copy' + currentName.slice(ext);
    } else {
      duplicateName = currentName + ' copy';
    }
    setInputModal({ type: 'duplicateFile', fileId, parentFolderId, currentName });
    setInputValue(duplicateName);
  }, []);

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

  const handleFolderDownload = useCallback(
    (folderId: FolderId) => {
      if (!workbook) return;
      foldersApi.downloadFolder(workbook.id, folderId);
    },
    [workbook],
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
        case 'duplicateFile':
          // Copy file to same folder with new name
          const newFile = await filesApi.copyFile(workbook.id, inputModal.fileId, inputModal.parentFolderId);
          // If the name is different from what copyFile generated, rename it
          if (newFile.name !== inputValue.trim()) {
            await filesApi.updateFile(workbook.id, newFile.id, { name: inputValue.trim() });
          }
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
      case 'duplicateFile':
        return 'Duplicate File';
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
      case 'duplicateFile':
        return 'File name';
    }
  };

  const getInputModalButtonText = () => {
    if (!inputModal) return '';
    switch (inputModal.type) {
      case 'createFolder':
      case 'createFile':
        return 'Create';
      case 'renameFolder':
      case 'renameFile':
        return 'Rename';
      case 'duplicateFile':
        return 'Duplicate';
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
                    dragPreviewRender={(monitorProps) => {
                      const isMultiSelect = selectedNodes.has(monitorProps.item.id as string) && selectedNodes.size > 1;

                      if (isMultiSelect) {
                        return (
                          <div
                            style={{
                              backgroundColor: 'var(--mantine-color-blue-6)',
                              color: 'white',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 500,
                              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              width: 'max-content',
                            }}
                          >
                            <Box
                              style={{
                                background: 'white',
                                color: 'var(--mantine-color-blue-6)',
                                borderRadius: '50%',
                                width: '16px',
                                height: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                fontWeight: 700,
                              }}
                            >
                              {selectedNodes.size}
                            </Box>
                            Files
                          </div>
                        );
                      }

                      return (
                        <div
                          style={{
                            backgroundColor: 'white', // var(--bg-base) might be transparent in some contexts or dark
                            border: '1px solid var(--fg-divider)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            width: 'max-content',
                            color: 'var(--fg-primary)',
                          }}
                        >
                          {monitorProps.item.data?.isFile ? (
                            <FileTextIcon size={16} color="var(--fg-secondary)" />
                          ) : (
                            <FolderIcon size={16} color="var(--fg-secondary)" />
                          )}
                          <Text size="sm">{monitorProps.item.text}</Text>
                        </div>
                      );
                    }}
                    render={(node, { depth, isOpen, onToggle, isDropTarget }) => (
                      <TreeNodeRenderer
                        node={node}
                        depth={depth}
                        isOpen={isOpen}
                        onToggle={onToggle}
                        isSelected={selectedNodes.has(node.id as string)}
                        isDropTarget={isDropTarget}
                        isAdmin={!!isAdmin}
                        onNodeSelect={handleNodeSelect}
                        onFileDoubleClick={handleFileDoubleClick}
                        onExternalFileDrop={handleExternalFileDrop}
                        onFolderDetailsClick={handleFolderDetailsClick}
                        onFileRename={handleFileRename}
                        onFileDelete={handleFileDelete}
                        onFileDownload={handleFileDownload}
                        onFileCopy={handleFileCopy}
                        onFileMove={handleFileMove}
                        onFileDuplicate={handleFileDuplicate}
                        onFolderRename={handleFolderRename}
                        onFolderDelete={handleFolderDelete}
                        onFolderDownload={handleFolderDownload}
                        onShowInfo={handleShowInfo}
                        getNodePath={getNodePath}
                        onCreateFolderInFolder={handleCreateFolderInFolder}
                        onCreateFileInFolder={handleCreateFileInFolder}
                        selectedCount={selectedNodes.size}
                        areAllSelectedFiles={
                          selectedNodes.size > 0 &&
                          Array.from(selectedNodes).every((id) => treeData.find((n) => n.id === id)?.data?.isFile)
                        }
                        onBulkDelete={handleBulkDelete}
                        onBulkMove={handleBulkMove}
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
              {getInputModalButtonText()}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Copy File Modal */}
      <FolderPickerModal
        opened={!!copyFileId}
        onClose={() => setCopyFileId(null)}
        onSelect={handleFileCopyConfirm}
        folders={
          files?.items
            .filter((item): item is typeof item & { type: 'folder' } => item.type === 'folder')
            .map((f) => ({ type: 'folder' as const, id: f.id, name: f.name, parentFolderId: f.parentFolderId })) ?? []
        }
        title="Copy File To..."
        confirmText="Copy Here"
      />

      {/* Move File Modal */}
      <FolderPickerModal
        opened={!!moveFileIds}
        onClose={() => setMoveFileIds(null)}
        onSelect={handleFileMoveConfirm}
        folders={
          files?.items
            .filter((item): item is typeof item & { type: 'folder' } => item.type === 'folder')
            .map((f) => ({ type: 'folder' as const, id: f.id, name: f.name, parentFolderId: f.parentFolderId })) ?? []
        }
        title="Move File To..."
        confirmText="Move Here"
      />
    </DndProvider>
  );
}
