'use client';

import { ConnectorIcon } from '@/app/components/Icons/ConnectorIcon';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { Text12Medium, Text12Regular, TextMono12Regular } from '@/app/components/base/text';
import { useDataFolders } from '@/hooks/use-data-folders';
import { useFolderFileList } from '@/hooks/use-folder-file-list';
import { workbookApi } from '@/lib/api/workbook';
import { useNewWorkbookUIStore } from '@/stores/new-workbook-ui-store';
import { Badge, Box, Collapse, Group, Stack, TextInput, Tooltip, UnstyledButton } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import type { ConnectorAccount, DataFolder, DataFolderGroup, FileRefEntity, WorkbookId } from '@spinner/shared-types';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DownloadIcon,
  FilePlusIcon,
  FolderIcon,
  MoreHorizontalIcon,
  SearchIcon,
  StickyNoteIcon,
  Trash2Icon,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useMemo, useState, type MouseEvent } from 'react';
import { ChooseTablesModal } from '../shared/ChooseTablesModal';
import { ContextMenu } from '../shared/ContextMenu';
import { DeleteFolderModal } from '../shared/DeleteFolderModal';
import { NewFileModal } from '../shared/NewFileModal';
import { RemoveConnectionModal } from '../shared/RemoveConnectionModal';
import type { FileTreeMode } from './FileTree';

const SCRATCH_GROUP_NAME = 'Scratch';
const FILE_LIMIT = 100;
const INDENT_PX = 10;

// ============================================================================
// Connection Node (top-level group)
// ============================================================================

interface ConnectionNodeProps {
  group: DataFolderGroup;
  workbookId: WorkbookId;
  connectorAccount?: ConnectorAccount;
  mode?: FileTreeMode;
  dirtyFilePaths?: Set<string>;
}

export function ConnectionNode({ group, workbookId, connectorAccount, mode = 'files', dirtyFilePaths }: ConnectionNodeProps) {
  const expandedNodes = useNewWorkbookUIStore((state) => state.expandedNodes);
  const toggleNode = useNewWorkbookUIStore((state) => state.toggleNode);
  const router = useRouter();

  const nodeId = `connection-${group.name}`;
  const isExpanded = expandedNodes.has(nodeId);
  const isScratch = group.name === SCRATCH_GROUP_NAME;

  // Check if this connection has any dirty files (for review mode filtering)
  const hasDirtyFiles = useMemo(() => {
    if (mode !== 'review' || !dirtyFilePaths || dirtyFilePaths.size === 0) return true;

    // Check if any dirty file path starts with a folder path from this connection
    for (const folder of group.dataFolders) {
      for (const dirtyPath of dirtyFilePaths) {
        // Check if the dirty file belongs to this folder
        // The path format is typically: "ConnectionName/FolderName/filename.json"
        if (dirtyPath.startsWith(`${folder.name}/`) || dirtyPath.includes(`/${folder.name}/`)) {
          return true;
        }
      }
    }
    return false;
  }, [mode, dirtyFilePaths, group.dataFolders]);

  // Calculate dirty count across all folders in this connection
  const totalDirtyCount = useMemo(() => {
    // This would need to aggregate from all folder file lists
    // For now, we'll show it at the table level only
    return 0;
  }, []);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Choose tables modal state
  const [chooseTablesOpened, { open: openChooseTables, close: closeChooseTables }] = useDisclosure(false);

  // Remove connection modal state
  const [removeModalOpened, { open: openRemoveModal, close: closeRemoveModal }] = useDisclosure(false);

  // Pull handler
  const handlePullAll = async () => {
    try {
      await workbookApi.pullFiles(workbookId);
      router.refresh();
    } catch (error) {
      console.debug('Failed to pull files:', error);
    }
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleToggle = () => {
    toggleNode(nodeId);
  };

  const handleThreeDotsClick = (e: MouseEvent) => {
    e.stopPropagation();
    // Position menu near the button
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setContextMenu({ x: rect.right, y: rect.bottom });
  };

  // Connection status - use connectorAccount health if available
  const isConnected = connectorAccount
    ? connectorAccount.healthStatus === 'OK' || connectorAccount.healthStatus === null
    : true;

  // In review mode, hide connections with no dirty files
  if (mode === 'review' && !hasDirtyFiles) {
    return null;
  }

  return (
    <>
      <UnstyledButton
        onClick={handleToggle}
        onContextMenu={mode === 'files' ? handleContextMenu : undefined}
        px="sm"
        py={4}
        style={{
          width: '100%',
          backgroundColor: 'transparent',
        }}
        __vars={{
          '--hover-bg': 'var(--mantine-color-gray-1)',
        }}
        styles={{
          root: {
            '&:hover': {
              backgroundColor: 'var(--hover-bg)',
            },
          },
        }}
      >
        <Group gap={6} wrap="nowrap">
          <StyledLucideIcon
            Icon={isExpanded ? ChevronDownIcon : ChevronRightIcon}
            size="sm"
            c="var(--fg-secondary)"
          />

          {/* Icon */}
          {isScratch ? (
            <StyledLucideIcon Icon={StickyNoteIcon} size="sm" c="var(--fg-secondary)" />
          ) : group.service ? (
            <ConnectorIcon connector={group.service} size={16} p={0} />
          ) : (
            <StyledLucideIcon Icon={FolderIcon} size="sm" c="var(--fg-secondary)" />
          )}

          {/* Name */}
          <Text12Medium c="var(--fg-primary)" truncate style={{ fontWeight: 600 }}>
            {group.name}
          </Text12Medium>

          {/* Status dot - only on files page, immediately after name */}
          {mode === 'files' && !isScratch && (
            <Tooltip label={isConnected ? 'Connected' : 'Disconnected'} position="right">
              <Box
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: isConnected ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-red-6)',
                  flexShrink: 0,
                }}
              />
            </Tooltip>
          )}

          {/* Spacer */}
          <Box style={{ flex: 1 }} />

          {/* Dirty badge when collapsed */}
          {!isExpanded && totalDirtyCount > 0 && (
            <Badge size="xs" variant="filled" color="yellow" ml="auto">
              {totalDirtyCount}
            </Badge>
          )}

          {/* Three dots menu - only in files mode and for non-Scratch connections */}
          {mode === 'files' && !isScratch && connectorAccount && (
            <Box
              onClick={handleThreeDotsClick}
              style={{
                padding: 2,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                opacity: 0.5,
              }}
              onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.5'; }}
            >
              <StyledLucideIcon Icon={MoreHorizontalIcon} size="sm" c="var(--fg-secondary)" />
            </Box>
          )}
        </Group>
      </UnstyledButton>

      <Collapse in={isExpanded}>
        <Stack gap={0} pl={INDENT_PX}>
          {group.dataFolders.length === 0 ? (
            mode === 'files' && connectorAccount && (
              <Box pl={INDENT_PX + 14} py={4}>
                <UnstyledButton onClick={openChooseTables}>
                  <Text12Regular c="var(--mantine-color-blue-6)" style={{ cursor: 'pointer' }}>
                    Choose tables
                  </Text12Regular>
                </UnstyledButton>
              </Box>
            )
          ) : (
            group.dataFolders.map((folder) => (
              <TableNode
                key={folder.id}
                folder={folder}
                workbookId={workbookId}
                mode={mode}
                dirtyFilePaths={dirtyFilePaths}
              />
            ))
          )}
        </Stack>
      </Collapse>

      {/* Context Menu */}
      <ContextMenu
        opened={!!contextMenu}
        onClose={() => setContextMenu(null)}
        position={contextMenu ?? { x: 0, y: 0 }}
        items={[
          { label: 'Pull All Tables', icon: DownloadIcon, onClick: handlePullAll },
          ...(connectorAccount && !isScratch ? [{ label: 'Choose tables', onClick: openChooseTables }] : []),
          { type: 'divider' as const },
          { label: 'Reauthorize', onClick: () => console.debug('Reauthorize') },
          ...(connectorAccount && !isScratch ? [{ label: 'Remove', onClick: openRemoveModal, color: 'red' }] : []),
        ]}
      />

      {/* Choose Tables Modal */}
      {connectorAccount && (
        <ChooseTablesModal
          opened={chooseTablesOpened}
          onClose={closeChooseTables}
          workbookId={workbookId}
          connectorAccount={connectorAccount}
        />
      )}

      {/* Remove Connection Modal */}
      {connectorAccount && (
        <RemoveConnectionModal
          opened={removeModalOpened}
          onClose={closeRemoveModal}
          connectorAccount={connectorAccount}
          workbookId={workbookId}
        />
      )}
    </>
  );
}

// ============================================================================
// Table Node (folder within a connection)
// ============================================================================

interface TableNodeProps {
  folder: DataFolder;
  workbookId: WorkbookId;
  mode?: FileTreeMode;
  dirtyFilePaths?: Set<string>;
}

function TableNode({ folder, workbookId, mode = 'files', dirtyFilePaths }: TableNodeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const expandedNodes = useNewWorkbookUIStore((state) => state.expandedNodes);
  const toggleNode = useNewWorkbookUIStore((state) => state.toggleNode);
  const tableFilters = useNewWorkbookUIStore((state) => state.tableFilters);
  const setTableFilter = useNewWorkbookUIStore((state) => state.setTableFilter);
  const { deleteFolder } = useDataFolders();

  const nodeId = `table-${folder.id}`;
  const isExpanded = expandedNodes.has(nodeId);
  const filter = tableFilters[folder.id] ?? '';

  // Check if this folder is currently selected (showing in the right panel)
  const routeBase = mode === 'review' ? 'review' : 'files';
  const folderPath = `/workbook/${workbookId}/${routeBase}/${encodeURIComponent(folder.name)}`;
  const isSelected = pathname === folderPath;

  const { files, isLoading } = useFolderFileList(workbookId, folder.id);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showFilter, setShowFilter] = useState(false);

  // Modal states
  const [newFileModalOpened, { open: openNewFileModal, close: closeNewFileModal }] = useDisclosure(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);

  // Filter and limit files
  const { displayedFiles, hiddenCount, dirtyCount, hasAnyDirtyFiles } = useMemo(() => {
    let fileItems = files.filter((f): f is FileRefEntity => f.type === 'file');

    // In review mode, only show dirty files
    if (mode === 'review' && dirtyFilePaths) {
      fileItems = fileItems.filter((f) => dirtyFilePaths.has(f.path));
    }

    let filtered = fileItems;

    if (filter) {
      const lowerFilter = filter.toLowerCase();
      filtered = fileItems.filter((f) => f.name.toLowerCase().includes(lowerFilter));
    }

    const dirty = fileItems.filter((f) => f.status === 'modified' || f.status === 'created').length;
    const limited = filtered.slice(0, FILE_LIMIT);
    const hidden = Math.max(0, filtered.length - FILE_LIMIT);

    return {
      displayedFiles: limited,
      hiddenCount: hidden,
      dirtyCount: dirty,
      hasAnyDirtyFiles: fileItems.length > 0,
    };
  }, [files, filter, mode, dirtyFilePaths]);

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // Chevron click: just toggle expand/collapse
  const handleChevronClick = (e: MouseEvent) => {
    e.stopPropagation();
    toggleNode(nodeId);
  };

  // Row click (folder name): navigate to folder detail AND expand if collapsed
  const handleRowClick = () => {
    const routeBase = mode === 'review' ? 'review' : 'files';
    router.push(`/workbook/${workbookId}/${routeBase}/${encodeURIComponent(folder.name)}`);
    // Also expand if not already expanded
    if (!isExpanded) {
      toggleNode(nodeId);
    }
  };

  // In review mode, hide tables with no dirty files
  if (mode === 'review' && !hasAnyDirtyFiles && !isLoading) {
    return null;
  }

  return (
    <>
      <UnstyledButton
        onClick={handleRowClick}
        onContextMenu={mode === 'files' ? handleContextMenu : undefined}
        px="sm"
        py={4}
        style={{
          width: '100%',
          marginLeft: INDENT_PX,
          backgroundColor: isSelected ? 'var(--bg-selected)' : 'transparent',
          borderLeft: isSelected ? '3px solid var(--mantine-primary-color-filled)' : '3px solid transparent',
        }}
        __vars={{
          '--hover-bg': 'var(--mantine-color-gray-1)',
        }}
        styles={{
          root: {
            '&:hover': {
              backgroundColor: isSelected ? 'var(--bg-selected)' : 'var(--hover-bg)',
            },
          },
        }}
      >
        <Group gap={6} wrap="nowrap">
          {/* Chevron: separate click target for expand/collapse only */}
          <Box
            onClick={handleChevronClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              marginLeft: -4,
              marginRight: -4,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <StyledLucideIcon
              Icon={isExpanded ? ChevronDownIcon : ChevronRightIcon}
              size="sm"
              c="var(--fg-secondary)"
            />
          </Box>
          <StyledLucideIcon Icon={FolderIcon} size="sm" c="var(--fg-secondary)" />
          <Text12Regular c="var(--fg-primary)" truncate style={{ flex: 1 }}>
            {folder.name}
          </Text12Regular>

          {/* Dirty badge when collapsed */}
          {!isExpanded && dirtyCount > 0 && (
            <Badge size="xs" variant="filled" color="yellow">
              {dirtyCount}
            </Badge>
          )}
        </Group>
      </UnstyledButton>

      <Collapse in={isExpanded}>
        <Stack gap={0} pl={INDENT_PX * 2} pr="sm">
          {/* Inline filter */}
          {(showFilter || filter) && (
            <TextInput
              size="xs"
              placeholder="Filter files..."
              value={filter}
              onChange={(e) => setTableFilter(folder.id, e.currentTarget.value)}
              ml={INDENT_PX}
              my={4}
              styles={{
                input: {
                  fontSize: 11,
                  height: 24,
                  minHeight: 24,
                },
              }}
            />
          )}

          {/* Loading state */}
          {isLoading && files.length === 0 && (
            <Box ml={INDENT_PX} py={4}>
              <Text12Regular c="dimmed">Loading...</Text12Regular>
            </Box>
          )}

          {/* File list */}
          {displayedFiles.map((file) => (
            <FileNode key={file.id} file={file} mode={mode} />
          ))}

          {/* Hidden count indicator - links to folder view */}
          {hiddenCount > 0 && (
            <Box ml={INDENT_PX} py={4}>
              <Link href={`/workbook/${workbookId}/files/${encodeURIComponent(folder.name)}`} style={{ textDecoration: 'none' }}>
                <Text12Regular c="var(--mantine-color-blue-6)" style={{ cursor: 'pointer' }}>
                  {hiddenCount} more...
                </Text12Regular>
              </Link>
            </Box>
          )}

          {/* Empty state */}
          {!isLoading && displayedFiles.length === 0 && (
            <Box ml={INDENT_PX} py={4}>
              <Text12Regular c="dimmed">{filter ? 'No matching files' : 'No files'}</Text12Regular>
            </Box>
          )}
        </Stack>
      </Collapse>

      {/* Context Menu */}
      <ContextMenu
        opened={!!contextMenu}
        onClose={() => setContextMenu(null)}
        position={contextMenu ?? { x: 0, y: 0 }}
        items={[
          { label: 'New File', icon: FilePlusIcon, onClick: () => { openNewFileModal(); setContextMenu(null); } },
          { label: 'Filter', icon: SearchIcon, onClick: () => { setShowFilter(true); setContextMenu(null); } },
          { type: 'divider' },
          { label: 'Download', icon: DownloadIcon, onClick: () => console.debug('Download'), disabled: true },
          { label: 'Delete', icon: Trash2Icon, onClick: () => { openDeleteModal(); setContextMenu(null); }, color: 'red' },
        ]}
      />

      {/* New File Modal */}
      <NewFileModal
        opened={newFileModalOpened}
        onClose={closeNewFileModal}
        folder={folder}
        workbookId={workbookId}
      />

      {/* Delete Folder Modal */}
      <DeleteFolderModal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        folder={folder}
        onConfirm={async () => {
          await deleteFolder(folder.id);
          closeDeleteModal();
        }}
      />
    </>
  );
}

// ============================================================================
// File Node (individual file)
// ============================================================================

interface FileNodeProps {
  file: FileRefEntity;
  mode?: FileTreeMode;
}

function FileNode({ file, mode = 'files' }: FileNodeProps) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();

  // Build the file path for the URL - encode each segment but keep slashes
  const filePath = file.path;
  const encodedPath = filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  // Use the appropriate route based on mode
  const routeBase = mode === 'review' ? 'review' : 'files';
  const href = `/workbook/${params.id}/${routeBase}/${encodedPath}`;

  // Check if this file is currently selected
  const isSelected = pathname.includes(`/${routeBase}/${encodedPath}`);

  // Determine if file is dirty (modified)
  const isDirty = file.status === 'modified' || file.status === 'created';

  // Text color: yellow for dirty files, primary otherwise
  const textColor = isDirty ? 'var(--mantine-color-yellow-6)' : 'var(--fg-primary)';

  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <UnstyledButton
        px="sm"
        py={4}
        style={{
          width: '100%',
          marginLeft: INDENT_PX,
          backgroundColor: isSelected ? 'var(--bg-selected)' : 'transparent',
          borderLeft: isSelected ? '3px solid var(--mantine-primary-color-filled)' : '3px solid transparent',
        }}
        __vars={{
          '--hover-bg': 'var(--mantine-color-gray-1)',
        }}
        styles={{
          root: {
            '&:hover': {
              backgroundColor: isSelected ? 'var(--bg-selected)' : 'var(--hover-bg)',
            },
          },
        }}
      >
        <Group gap={6} wrap="nowrap">
          {/* Dirty indicator dot */}
          {isDirty ? (
            <Box
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: 'var(--mantine-color-yellow-6)',
                flexShrink: 0,
              }}
            />
          ) : (
            <Box
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                border: '1px solid var(--fg-muted)',
                flexShrink: 0,
              }}
            />
          )}

          <TextMono12Regular c={textColor} truncate style={{ flex: 1 }}>
            {file.name}
          </TextMono12Regular>
        </Group>
      </UnstyledButton>
    </Link>
  );
}

// ============================================================================
// Empty Connection Node (connector account without data folders)
// ============================================================================

interface EmptyConnectionNodeProps {
  connectorAccount: ConnectorAccount;
  workbookId: WorkbookId;
}

export function EmptyConnectionNode({ connectorAccount, workbookId }: EmptyConnectionNodeProps) {
  const expandedNodes = useNewWorkbookUIStore((state) => state.expandedNodes);
  const toggleNode = useNewWorkbookUIStore((state) => state.toggleNode);

  const nodeId = `connection-${connectorAccount.displayName || connectorAccount.id}`;
  const isExpanded = expandedNodes.has(nodeId);

  // Connection health status
  const isConnected = connectorAccount.healthStatus === 'OK' || connectorAccount.healthStatus === null;

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Choose tables modal state
  const [chooseTablesOpened, { open: openChooseTables, close: closeChooseTables }] = useDisclosure(false);

  // Remove connection modal state
  const [removeModalOpened, { open: openRemoveModal, close: closeRemoveModal }] = useDisclosure(false);

  const handleToggle = () => {
    toggleNode(nodeId);
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleThreeDotsClick = (e: MouseEvent) => {
    e.stopPropagation();
    // Position menu near the button
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setContextMenu({ x: rect.right, y: rect.bottom });
  };

  return (
    <>
      <UnstyledButton
        onClick={handleToggle}
        onContextMenu={handleContextMenu}
        px="sm"
        py={4}
        style={{
          width: '100%',
          backgroundColor: 'transparent',
        }}
        __vars={{
          '--hover-bg': 'var(--mantine-color-gray-1)',
        }}
        styles={{
          root: {
            '&:hover': {
              backgroundColor: 'var(--hover-bg)',
            },
          },
        }}
      >
        <Group gap={6} wrap="nowrap">
          <StyledLucideIcon
            Icon={isExpanded ? ChevronDownIcon : ChevronRightIcon}
            size="sm"
            c="var(--fg-secondary)"
          />

          {/* Icon */}
          <ConnectorIcon connector={connectorAccount.service} size={16} p={0} />

          {/* Name */}
          <Text12Medium c="var(--fg-primary)" truncate style={{ fontWeight: 600 }}>
            {connectorAccount.displayName}
          </Text12Medium>

          {/* Status dot - immediately after name */}
          <Tooltip label={isConnected ? 'Connected' : 'Connection error'} position="right">
            <Box
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: isConnected ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-red-6)',
                flexShrink: 0,
              }}
            />
          </Tooltip>

          {/* Spacer */}
          <Box style={{ flex: 1 }} />

          {/* Three dots menu */}
          <Box
            onClick={handleThreeDotsClick}
            style={{
              padding: 2,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              opacity: 0.5,
            }}
            onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.5'; }}
          >
            <StyledLucideIcon Icon={MoreHorizontalIcon} size="sm" c="var(--fg-secondary)" />
          </Box>
        </Group>
      </UnstyledButton>

      {/* Expanded content - show "Choose tables" link */}
      <Collapse in={isExpanded}>
        <Box pl={INDENT_PX + 24} py={4}>
          <UnstyledButton onClick={openChooseTables}>
            <Text12Regular c="var(--mantine-color-blue-6)" style={{ cursor: 'pointer' }}>
              Choose tables
            </Text12Regular>
          </UnstyledButton>
        </Box>
      </Collapse>

      {/* Context Menu */}
      <ContextMenu
        opened={!!contextMenu}
        onClose={() => setContextMenu(null)}
        position={contextMenu ?? { x: 0, y: 0 }}
        items={[
          { label: 'Choose tables', onClick: openChooseTables },
          { type: 'divider' },
          { label: 'Reauthorize', onClick: () => console.debug('Reauthorize') },
          { label: 'Remove', onClick: openRemoveModal, color: 'red' },
        ]}
      />

      {/* Choose Tables Modal */}
      <ChooseTablesModal
        opened={chooseTablesOpened}
        onClose={closeChooseTables}
        workbookId={workbookId}
        connectorAccount={connectorAccount}
      />

      {/* Remove Connection Modal */}
      <RemoveConnectionModal
        opened={removeModalOpened}
        onClose={closeRemoveModal}
        connectorAccount={connectorAccount}
        workbookId={workbookId}
      />
    </>
  );
}
