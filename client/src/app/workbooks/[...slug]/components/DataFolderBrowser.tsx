'use client';

import { ConnectorIcon } from '@/app/components/Icons/ConnectorIcon';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { Text13Medium, Text13Regular } from '@/app/components/base/text';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useDataFolders } from '@/hooks/use-data-folders';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { workbookApi } from '@/lib/api/workbook';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import {
  Accordion,
  ActionIcon,
  Box,
  Button,
  Checkbox,
  Code,
  Collapse,
  Group,
  Loader,
  Menu,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import type { DataFolder, DataFolderGroup, DataFolderId, WorkbookId } from '@spinner/shared-types';
import {
  BlocksIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyMinusIcon,
  CopyPlusIcon,
  DownloadIcon,
  FileDiffIcon,
  FilePlusIcon,
  FolderIcon,
  FolderSearchIcon,
  FolderSyncIcon,
  GitBranchIcon,
  StickyNoteIcon,
  Trash2Icon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { GitBrowserModal } from '../../components/GitBrowserModal';
import { GitGraphModal } from '../../components/GitGraphModal';
import { VersionsModal } from '../../components/VersionsModal';
import styles from './DataFolderBrowser.module.css';

interface DataFolderBrowserProps {
  onFolderSelect?: (folderId: DataFolderId) => void;
}

const SCRATCH_GROUP_NAME = 'Scratch';

export function DataFolderBrowser({ onFolderSelect }: DataFolderBrowserProps) {
  const { dataFolderGroups, isLoading, deleteFolder } = useDataFolders();
  const { workbook } = useActiveWorkbook();
  const { isAdmin } = useScratchPadUser();
  const openFileTab = useWorkbookEditorUIStore((state) => state.openFileTab);
  const openFileTabs = useWorkbookEditorUIStore((state) => state.openFileTabs);
  const activeFileTabId = useWorkbookEditorUIStore((state) => state.activeFileTabId);
  const closeFileTabs = useWorkbookEditorUIStore((state) => state.closeFileTabs);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedFolderId, setSelectedFolderId] = useState<DataFolderId | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    folder: DataFolder;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Git menu state
  const [gitBrowserOpen, setGitBrowserOpen] = useState(false);
  const [gitGraphOpen, setGitGraphOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [gitStatusOpen, setGitStatusOpen] = useState(false);
  const [gitStatus, setGitStatus] = useState<object | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // New File Modal State
  const [newFileModalState, setNewFileModalState] = useState<{ isOpen: boolean; folder: DataFolder | null }>({
    isOpen: false,
    folder: null,
  });

  const handleOpenNewFileModal = useCallback((folder: DataFolder | null) => {
    if (folder) {
      setNewFileModalState({ isOpen: true, folder });
    }
  }, []);

  const handleGitStatus = useCallback(async () => {
    if (!workbook) return;
    setLoadingStatus(true);
    setGitStatus(null);
    setGitStatusOpen(true);
    try {
      const data = await workbookApi.getStatus(workbook.id);
      setGitStatus(data as object);
    } catch (e) {
      console.error(e);
      ScratchpadNotifications.error({
        title: 'Git Status Failed',
        message: 'Could not fetch git status.',
      });
    } finally {
      setLoadingStatus(false);
    }
  }, [workbook]);

  const handleBrowseFiles = useCallback(() => {
    setGitBrowserOpen(true);
  }, []);

  const handleVersions = useCallback(() => {
    setVersionsOpen(true);
  }, []);

  const handleGitGraph = useCallback(() => {
    setGitGraphOpen(true);
  }, []);

  const expandAllGroups = useCallback(() => {
    setExpandedGroups(new Set(dataFolderGroups.map((g) => g.name)));
  }, [dataFolderGroups]);

  const collapseAllGroups = useCallback(() => {
    setExpandedGroups(new Set());
  }, []);

  // Auto-expand all groups when data loads (only once)
  useEffect(() => {
    if (dataFolderGroups.length > 0 && !hasInitialized) {
      setExpandedGroups(new Set(dataFolderGroups.map((g) => g.name)));
      setHasInitialized(true);
    }
  }, [dataFolderGroups, hasInitialized]);

  // Sync selection with active file tab (for deep linking)
  useEffect(() => {
    if (!activeFileTabId || dataFolderGroups.length === 0) return;

    const activeTab = openFileTabs.find((t) => t.id === activeFileTabId);
    if (!activeTab?.path) return;

    // Find the folder that contains this file by matching path prefix
    for (const group of dataFolderGroups) {
      for (const folder of group.dataFolders) {
        const folderPath = folder.path ?? folder.name;
        if (activeTab.path.startsWith(folderPath)) {
          // Expand the group and select the folder
          setExpandedGroups((prev) => new Set([...prev, group.name]));
          setSelectedFolderId(folder.id);
          return;
        }
      }
    }
  }, [activeFileTabId, openFileTabs, dataFolderGroups]);

  const toggleGroup = useCallback((groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  }, []);

  const handleFolderClick = useCallback(
    (folder: DataFolder) => {
      setSelectedFolderId(folder.id);
      openFileTab({
        id: folder.id,
        type: 'folder',
        title: folder.name,
        path: folder.path ?? '',
      });
      onFolderSelect?.(folder.id);
    },
    [openFileTab, onFolderSelect],
  );

  const handleFolderDelete = useCallback(
    (folder: DataFolder) => {
      setConfirmModal({
        folder,
        onConfirm: async () => {
          const folderPath = folder.path ?? '';

          // Find tabs to close: the folder itself and any files within it
          const tabsToClose = openFileTabs.filter((tab) => {
            // Close the folder tab itself
            if (tab.id === folder.id) return true;
            // Close any tabs whose path starts with the folder's path
            if (folderPath && tab.path.startsWith(folderPath + '/')) return true;
            return false;
          });

          if (tabsToClose.length > 0) {
            closeFileTabs(tabsToClose.map((t) => t.id));
          }

          await deleteFolder(folder.id);
          setConfirmModal(null);
        },
      });
    },
    [deleteFolder, openFileTabs, closeFileTabs],
  );

  // Sort groups: Scratch first, then alphabetically by name
  const sortedGroups = useMemo(
    () =>
      [...dataFolderGroups].sort((a, b) => {
        if (a.name === SCRATCH_GROUP_NAME) return -1;
        if (b.name === SCRATCH_GROUP_NAME) return 1;
        return a.name.localeCompare(b.name);
      }),
    [dataFolderGroups],
  );

  return (
    <Accordion.Item value="apps">
      {/* Tree Header - Actions are outside Accordion.Control to avoid nested buttons */}
      <Box style={{ position: 'relative' }}>
        <Accordion.Control icon={<BlocksIcon size={14} color="var(--mantine-color-gray-7)" />}>
          <Text fw={500} size="sm" truncate w="100%" pr={140}>
            Apps
          </Text>
        </Accordion.Control>

        {/* Action icons positioned absolutely, outside of Accordion.Control to avoid button-in-button */}
        <Group
          gap={4}
          wrap="nowrap"
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: 'var(--bg-selected)',
            zIndex: 1,
          }}
          pl={8}
        >
          <Tooltip label="New File" openDelay={500}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (selectedFolderId) {
                  // Find the folder object from groups
                  const folder = dataFolderGroups
                    .flatMap((g) => g.dataFolders)
                    .find((f) => f.id === selectedFolderId);
                  if (folder) {
                    handleOpenNewFileModal(folder);
                  }
                }
              }}
              disabled={!selectedFolderId}
            >
              <FilePlusIcon size={14} />
            </ActionIcon>
          </Tooltip>
          {/* ... other actions ... */}
          <Tooltip label="New Linked Folder" openDelay={500}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                openFileTab({ id: 'add-table', type: 'add-table', title: 'New Linked Folder', path: '' });
              }}
            >
              <FolderSyncIcon size={14} />
            </ActionIcon>
          </Tooltip>

          <Box w={1} h={16} bg="var(--fg-divider)" mx={4} />

          <Tooltip label="Collapse All" openDelay={500}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                collapseAllGroups();
              }}
            >
              <CopyMinusIcon size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Expand All" openDelay={500}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                expandAllGroups();
              }}
            >
              <CopyPlusIcon size={14} />
            </ActionIcon>
          </Tooltip>

          <Box w={1} h={16} bg="var(--fg-divider)" mx={4} />

          {isAdmin && (
            <Menu shadow="md" width={200} position="bottom-end">
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  color="violet"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <GitBranchIcon size={14} />
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Item leftSection={<FileDiffIcon size={14} />} onClick={handleGitStatus} color="violet">
                  main vs dirty
                </Menu.Item>
                <Menu.Item leftSection={<GitBranchIcon size={14} />} onClick={handleGitGraph} color="violet">
                  Git Graph
                </Menu.Item>
                <Menu.Item leftSection={<GitBranchIcon size={14} />} onClick={handleVersions} color="violet">
                  Version History
                </Menu.Item>
                <Menu.Item leftSection={<FolderSearchIcon size={14} />} onClick={handleBrowseFiles} color="violet">
                  Browse Files
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </Box>

      <Accordion.Panel>
        {/* Fill available height */}
        <Stack flex={1} mih={0} gap={0} bg="var(--bg-base)">
          {isLoading ? (
            <Box p="md" className={styles.container}>
              <Group justify="center" p="lg">
                <Loader size="sm" />
              </Group>
            </Box>
          ) : (
            <ScrollArea className={styles.container} style={{ flex: 1, overflowX: 'hidden' }}>
              <Stack gap={0} w="100%">
                {sortedGroups.map((group) => (
                  <DataFolderGroupItem
                    key={group.name}
                    group={group}
                    isExpanded={expandedGroups.has(group.name)}
                    onToggle={() => toggleGroup(group.name)}
                    selectedFolderId={selectedFolderId}
                    onFolderClick={handleFolderClick}
                    onFolderDelete={handleFolderDelete}
                    onNewFile={handleOpenNewFileModal}
                  />
                ))}
              </Stack>
            </ScrollArea>
          )}
        </Stack>
        {/* Modals ... */}
        <Modal opened={!!confirmModal} onClose={() => setConfirmModal(null)} title="Delete Folder" size="sm" centered>
          <Stack gap="md">
            <Text size="sm">
              Are you sure you want to delete &quot;{confirmModal?.folder.name}&quot;? This action cannot be undone.
            </Text>
            <Group justify="flex-end" gap="sm">
              <Button variant="subtle" color="gray" onClick={() => setConfirmModal(null)}>
                Cancel
              </Button>
              <Button color="red" onClick={confirmModal?.onConfirm}>
                Delete
              </Button>
            </Group>
          </Stack>
        </Modal>

        {workbook && (
          <GitBrowserModal workbookId={workbook.id} isOpen={gitBrowserOpen} onClose={() => setGitBrowserOpen(false)} />
        )}
        {workbook && (
          <GitGraphModal workbookId={workbook.id} isOpen={gitGraphOpen} onClose={() => setGitGraphOpen(false)} />
        )}
        {workbook && (
          <VersionsModal
            workbookId={workbook.id}
            isOpen={versionsOpen}
            onClose={() => setVersionsOpen(false)}
            onSuccess={() => {
              // Maybe refresh data folders or something if needed?
              // Since versions affect the FS, we might assume live queries handle it
              setVersionsOpen(false);
            }}
          />
        )}

        <Modal opened={gitStatusOpen} onClose={() => setGitStatusOpen(false)} title="Git Status" size="lg">
          {loadingStatus ? (
            <Group justify="center" p="xl">
              <Loader size="sm" />
            </Group>
          ) : (
            <ScrollArea.Autosize style={{ maxHeight: 500 }}>
              <Code block>{gitStatus ? JSON.stringify(gitStatus, null, 2) : 'No status data'}</Code>
            </ScrollArea.Autosize>
          )}
        </Modal>

        {workbook && (
          <NewFileModal
            isOpen={newFileModalState.isOpen}
            onClose={() => setNewFileModalState((prev) => ({ ...prev, isOpen: false }))}
            folder={newFileModalState.folder}
            workbookId={workbook.id}
            onSuccess={() => {
              // maybe refresh?
            }}
          />
        )}
      </Accordion.Panel>
    </Accordion.Item>
  );
}

interface DataFolderItemProps {
  folder: DataFolder;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
  onNewFile: (folder: DataFolder) => void;
}

function DataFolderItem({ folder, isSelected, onClick, onDelete, onNewFile }: DataFolderItemProps) {
  const [menuOpened, setMenuOpened] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const handleContextMenu = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setMenuOpened(true);
  };

  const handleNewFile = () => {
    onNewFile(folder);
    setMenuOpened(false);
  };

  const handleDownload = () => {
    console.log('Download clicked for folder:', folder.id);
    setMenuOpened(false);
  };

  const handleDelete = async () => {
    await onDelete();
    setMenuOpened(false);
  };

  return (
    <>
      <UnstyledButton
        className={`${styles.folderItem} ${isSelected ? styles.folderItemSelected : ''}`}
        onClick={onClick}
        onContextMenu={handleContextMenu}
      >
        <Group gap="xs" wrap="nowrap">
          <StyledLucideIcon Icon={FolderIcon} size="sm" c="var(--fg-secondary)" />
          <Text13Regular className={styles.folderName} truncate>
            {folder.name}
          </Text13Regular>
        </Group>
      </UnstyledButton>

      <Menu opened={menuOpened} onChange={setMenuOpened} position="bottom-start" withinPortal>
        <Menu.Target>
          <Box style={{ position: 'fixed', top: menuPosition.y, left: menuPosition.x, width: 0, height: 0 }} />
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<FilePlusIcon size={16} />} onClick={handleNewFile}>
            New File
          </Menu.Item>
          <Menu.Item leftSection={<DownloadIcon size={16} />} onClick={handleDownload} disabled>
            Download
          </Menu.Item>
          <Menu.Item leftSection={<Trash2Icon size={16} />} color="red" onClick={handleDelete}>
            Delete
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </>
  );
}

interface DataFolderGroupItemProps {
  group: DataFolderGroup;
  isExpanded: boolean;
  onToggle: () => void;
  selectedFolderId: DataFolderId | null;
  onFolderClick: (folder: DataFolder) => void;
  onFolderDelete: (folder: DataFolder) => void;
  onNewFile: (folder: DataFolder) => void;
}

function DataFolderGroupItem({
  group,
  isExpanded,
  onToggle,
  selectedFolderId,
  onFolderClick,
  onFolderDelete,
  onNewFile,
}: DataFolderGroupItemProps) {
  const isScratch = group.name === SCRATCH_GROUP_NAME;

  return (
    <Box className={styles.groupContainer}>
      <UnstyledButton className={styles.groupHeader} onClick={onToggle}>
        <Group gap="xs" wrap="nowrap">
          <StyledLucideIcon Icon={isExpanded ? ChevronDownIcon : ChevronRightIcon} size="sm" c="var(--fg-secondary)" />
          {isScratch ? (
            <StyledLucideIcon Icon={StickyNoteIcon} size="sm" c="var(--fg-secondary)" />
          ) : group.service ? (
            <ConnectorIcon connector={group.service} size={16} p={0} />
          ) : (
            <StyledLucideIcon Icon={FolderIcon} size="sm" c="var(--fg-secondary)" />
          )}
          <Text13Medium className={styles.groupName}>{group.name}</Text13Medium>
        </Group>
      </UnstyledButton>

      <Collapse in={isExpanded}>
        <Stack gap={0} className={styles.folderList}>
          {group.dataFolders.map((folder) => (
            <DataFolderItem
              key={folder.id}
              folder={folder}
              isSelected={selectedFolderId === folder.id}
              onClick={() => onFolderClick(folder)}
              onDelete={() => onFolderDelete(folder)}
              onNewFile={onNewFile}
            />
          ))}
          {group.dataFolders.length === 0 && (
            <Box className={styles.emptyFolder}>
              <Text13Regular c="dimmed">No folders</Text13Regular>
            </Box>
          )}
        </Stack>
      </Collapse>
    </Box>
  );
}

interface NewFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder: DataFolder | null;
  onSuccess: () => void;
  workbookId: string;
}

function NewFileModal({ isOpen, onClose, folder, onSuccess, workbookId }: NewFileModalProps) {
  const [fileName, setFileName] = useState('');
  const [useTemplate, setUseTemplate] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFileName('');
      setUseTemplate(true);
    }
  }, [isOpen]);

  const handleCreate = async () => {
    if (!folder || !fileName.trim()) return;

    setLoading(true);
    try {
      await workbookApi.createDataFolderFile(folder.id, fileName, useTemplate, workbookId as WorkbookId);

      ScratchpadNotifications.success({
        title: 'File Created',
        message: `Created ${fileName}`,
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to create file', error);
      ScratchpadNotifications.error({
        title: 'Creation Failed',
        message: 'Could not create file.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={isOpen} onClose={onClose} title="New File" size="sm" centered>
      <Stack gap="md">
        <TextInput
          label="Name"
          placeholder="e.g., config.json"
          value={fileName}
          onChange={(e) => setFileName(e.currentTarget.value)}
          data-autofocus
        />
        <Checkbox
          label="Use Template"
          checked={useTemplate}
          onChange={(e) => setUseTemplate(e.currentTarget.checked)}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} loading={loading} disabled={!fileName.trim()}>
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
