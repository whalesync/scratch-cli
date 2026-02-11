'use client';

import { ConnectorIcon } from '@/app/components/Icons/ConnectorIcon';
import { SpinningIcon } from '@/app/components/Icons/SpinningIcon';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { Text12Medium, Text12Regular, TextMono12Regular } from '@/app/components/base/text';
import { useActiveJobs } from '@/hooks/use-active-jobs';
import { useDevTools } from '@/hooks/use-dev-tools';
import { useFolderFileList } from '@/hooks/use-folder-file-list';
import { workbookApi } from '@/lib/api/workbook';
import { useNewWorkbookUIStore } from '@/stores/new-workbook-ui-store';
import { Badge, Box, Collapse, Group, Stack, Tooltip, UnstyledButton } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import type { ConnectorAccount, DataFolder, DataFolderGroup, FileRefEntity, WorkbookId } from '@spinner/shared-types';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DownloadIcon,
  FileJsonIcon,
  FilePlusIcon,
  FolderIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  StickyNoteIcon,
  Trash2Icon,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, type MouseEvent } from 'react';
import { ChooseTablesModal } from '../shared/ChooseTablesModal';
import { ContextMenu } from '../shared/ContextMenu';
import { DataFolderSchemaModal } from '../shared/DataFolderSchemaModal';
import { NewFileModal } from '../shared/NewFileModal';
import { RemoveConnectionModal } from '../shared/RemoveConnectionModal';
import { RemoveTableModal } from '../shared/RemoveTableModal';
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

export function ConnectionNode({
  group,
  workbookId,
  connectorAccount,
  mode = 'files',
  dirtyFilePaths,
}: ConnectionNodeProps) {
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

  const handleToggle = useCallback(() => {
    toggleNode(nodeId);
  }, [toggleNode, nodeId]);

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
        <Group gap={6} wrap="nowrap" justify="space-between">
          <Group gap={6} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
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
          </Group>

          {/* Right side items */}
          <Group gap={6} wrap="nowrap">
            {/* Dirty badge when collapsed */}
            {!isExpanded && totalDirtyCount > 0 && (
              <Badge size="xs" variant="filled" color="orange">
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
                onMouseOver={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = '1';
                }}
                onMouseOut={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = '0.5';
                }}
              >
                <StyledLucideIcon Icon={MoreHorizontalIcon} size="sm" c="var(--fg-secondary)" />
              </Box>
            )}
          </Group>
        </Group>
      </UnstyledButton>

      <Collapse in={isExpanded}>
        <Stack gap={0} pl={INDENT_PX}>
          {group.dataFolders.length === 0
            ? mode === 'files' &&
              connectorAccount && (
                <Box pl={INDENT_PX + 14} py={4}>
                  <UnstyledButton onClick={openChooseTables}>
                    <Text12Regular c="var(--mantine-color-blue-6)" style={{ cursor: 'pointer' }}>
                      Choose tables
                    </Text12Regular>
                  </UnstyledButton>
                </Box>
              )
            : group.dataFolders.map((folder) => (
                <TableNode
                  key={folder.id}
                  folder={folder}
                  workbookId={workbookId}
                  mode={mode}
                  dirtyFilePaths={dirtyFilePaths}
                />
              ))}
        </Stack>
      </Collapse>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          opened={true}
          onClose={() => setContextMenu(null)}
          position={contextMenu}
          items={[
            { label: 'Pull All Tables', icon: DownloadIcon, onClick: handlePullAll },
            ...(connectorAccount && !isScratch ? [{ label: 'Choose tables', onClick: openChooseTables }] : []),
            { type: 'divider' as const },
            { label: 'Reauthorize', onClick: () => console.debug('Reauthorize') },
            ...(connectorAccount && !isScratch
              ? [{ label: 'Remove', icon: Trash2Icon, onClick: openRemoveModal, delete: true }]
              : []),
          ]}
        />
      )}

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
  const { isDevToolsEnabled } = useDevTools();
  const { activeJobs } = useActiveJobs(folder.id, folder.lock !== null);

  const nodeId = `table-${folder.id}`;
  const isExpanded = expandedNodes.has(nodeId);

  // Check if this folder is currently selected (showing in the right panel)
  const routeBase = mode === 'review' ? 'review' : 'files';
  const folderPath = `/workbook/${workbookId}/${routeBase}/${encodeURIComponent(folder.name)}`;
  const isSelected = pathname === folderPath;

  const { files, isLoading } = useFolderFileList(workbookId, folder.id);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Modal states
  const [newFileModalOpened, { open: openNewFileModal, close: closeNewFileModal }] = useDisclosure(false);
  const [removeModalOpened, { open: openRemoveModal, close: closeRemoveModal }] = useDisclosure(false);
  const [schemaModalOpened, { open: openSchemaModal, close: closeSchemaModal }] = useDisclosure(false);

  // Pull handler for this table
  const handlePullTable = async () => {
    try {
      await workbookApi.pullFiles(workbookId, [folder.id]);
      router.refresh();
    } catch (error) {
      console.debug('Failed to pull table:', error);
    }
  };

  // Limit files for display
  const { displayedFiles, hiddenCount, dirtyCount, hasAnyDirtyFiles } = useMemo(() => {
    let fileItems = files.filter((f): f is FileRefEntity => f.type === 'file');

    // In review mode, only show dirty files
    if (mode === 'review' && dirtyFilePaths) {
      fileItems = fileItems.filter((f) => dirtyFilePaths.has(f.path));
    }

    const dirty = fileItems.filter((f) => f.status === 'modified' || f.status === 'created').length;
    const limited = fileItems.slice(0, FILE_LIMIT);
    const hidden = Math.max(0, fileItems.length - FILE_LIMIT);

    return {
      displayedFiles: limited,
      hiddenCount: hidden,
      dirtyCount: dirty,
      hasAnyDirtyFiles: fileItems.length > 0,
    };
  }, [files, mode, dirtyFilePaths]);

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // Chevron click: just toggle expand/collapse
  const handleChevronClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      toggleNode(nodeId);
    },
    [toggleNode, nodeId],
  );

  // Row click (folder name): navigate to folder detail AND expand if collapsed
  const handleRowClick = useCallback(() => {
    const routeBase = mode === 'review' ? 'review' : 'files';
    router.push(`/workbook/${workbookId}/${routeBase}/${encodeURIComponent(folder.name)}`);
    // Also expand if not already expanded
    if (!isExpanded) {
      toggleNode(nodeId);
    }
  }, [mode, router, workbookId, folder.name, isExpanded, toggleNode, nodeId]);

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
          width: `calc(100% - ${INDENT_PX}px)`,
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
        <Group gap={6} wrap="nowrap" justify="space-between">
          <Group gap={6} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
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
            <Text12Regular c="var(--fg-primary)" truncate>
              {folder.name}
            </Text12Regular>
          </Group>

          {/* Dirty badge when collapsed */}
          {!isExpanded && dirtyCount > 0 && (
            <Badge size="xs" variant="filled" color="orange">
              {dirtyCount}
            </Badge>
          )}

          {/* Active jobs badge */}
          {activeJobs.length > 0 && <SpinningIcon Icon={RefreshCwIcon} size={12} c="var(--mantine-color-blue-6)" />}
        </Group>
      </UnstyledButton>

      <Collapse in={isExpanded}>
        <Stack gap={0} pl={INDENT_PX * 2} pr="sm">
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
              <Link
                href={`/workbook/${workbookId}/files/${encodeURIComponent(folder.name)}`}
                style={{ textDecoration: 'none' }}
              >
                <Text12Regular c="var(--mantine-color-blue-6)" style={{ cursor: 'pointer' }}>
                  {hiddenCount} more...
                </Text12Regular>
              </Link>
            </Box>
          )}

          {/* Empty state */}
          {!isLoading && displayedFiles.length === 0 && (
            <Box ml={INDENT_PX} py={4}>
              <Text12Regular c="dimmed">No files</Text12Regular>
            </Box>
          )}
        </Stack>
      </Collapse>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          opened={true}
          onClose={() => setContextMenu(null)}
          position={contextMenu}
          items={[
            { label: 'Pull this table', icon: DownloadIcon, onClick: handlePullTable },
            {
              label: 'New File',
              icon: FilePlusIcon,
              onClick: () => {
                openNewFileModal();
                setContextMenu(null);
              },
            },
            { type: 'divider' },
            { label: 'Remove this table', icon: Trash2Icon, onClick: openRemoveModal, delete: true },
            ...(isDevToolsEnabled
              ? [
                  { type: 'divider' as const },
                  { label: 'View Schema', icon: FileJsonIcon, onClick: openSchemaModal, devtool: true },
                ]
              : []),
          ]}
        />
      )}

      {/* New File Modal */}
      <NewFileModal opened={newFileModalOpened} onClose={closeNewFileModal} folder={folder} workbookId={workbookId} />

      {/* Remove Table Modal */}
      <RemoveTableModal opened={removeModalOpened} onClose={closeRemoveModal} folder={folder} workbookId={workbookId} />

      {/* Schema Modal (dev tools only) */}
      {isDevToolsEnabled && (
        <DataFolderSchemaModal opened={schemaModalOpened} onClose={closeSchemaModal} folder={folder} />
      )}
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

  // Text color: always primary (the dot indicator is enough)
  const textColor = 'var(--fg-primary)';

  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <UnstyledButton
        px="sm"
        py={4}
        style={{
          width: `calc(100% - ${INDENT_PX}px)`,
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
          {/* Dirty indicator dot (or spacer for alignment) */}
          <Box
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: isDirty ? 'var(--mantine-color-orange-6)' : 'transparent',
              flexShrink: 0,
            }}
          />

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

  const handleToggle = useCallback(() => {
    toggleNode(nodeId);
  }, [toggleNode, nodeId]);

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
          <StyledLucideIcon Icon={isExpanded ? ChevronDownIcon : ChevronRightIcon} size="sm" c="var(--fg-secondary)" />

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
            onMouseOver={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = '1';
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = '0.5';
            }}
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
      {contextMenu && (
        <ContextMenu
          opened={true}
          onClose={() => setContextMenu(null)}
          position={contextMenu}
          items={[
            { label: 'Choose tables', onClick: openChooseTables },
            { type: 'divider' },
            { label: 'Reauthorize', onClick: () => console.debug('Reauthorize') },
            { label: 'Remove', icon: Trash2Icon, onClick: openRemoveModal, delete: true },
          ]}
        />
      )}

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
