'use client';

import { ConnectorIcon } from '@/app/components/Icons/ConnectorIcon';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { Text13Medium, Text13Regular } from '@/app/components/base/text';
import { useDataFolders } from '@/hooks/use-data-folders';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import {
  ActionIcon,
  Box,
  Button,
  Collapse,
  Group,
  Loader,
  Menu,
  Modal,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import type { DataFolder, DataFolderGroup, DataFolderId } from '@spinner/shared-types';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CopyMinusIcon,
  CopyPlusIcon,
  DownloadIcon,
  FilePlusIcon,
  FolderIcon,
  FolderPlusIcon,
  FolderSyncIcon,
  StickyNoteIcon,
  Trash2Icon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import styles from './DataFolderBrowser.module.css';

interface DataFolderBrowserProps {
  onFolderSelect?: (folderId: DataFolderId) => void;
}

const SCRATCH_GROUP_NAME = 'Scratch';

export function DataFolderBrowser({ onFolderSelect }: DataFolderBrowserProps) {
  const { dataFolderGroups, isLoading, deleteFolder } = useDataFolders();
  const openFileTab = useWorkbookEditorUIStore((state) => state.openFileTab);
  const openFileTabs = useWorkbookEditorUIStore((state) => state.openFileTabs);
  const closeFileTabs = useWorkbookEditorUIStore((state) => state.closeFileTabs);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedFolderId, setSelectedFolderId] = useState<DataFolderId | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    folder: DataFolder;
    onConfirm: () => Promise<void>;
  } | null>(null);

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

  if (isLoading) {
    return (
      <Box p="md" className={styles.container}>
        <Group justify="center" p="lg">
          <Loader size="sm" />
        </Group>
      </Box>
    );
  }

  return (
    <Stack h="100%" gap={0} bg="var(--bg-base)" style={{ border: '0.5px solid var(--fg-divider)' }}>
      {/* Tree Header */}
      <Group h={36} px="xs" justify="space-between" style={{ borderBottom: '0.5px solid var(--fg-divider)' }}>
        <Text fw={500} size="sm">
          Apps
        </Text>
        <Group gap={4}>
          <Tooltip label="New File" openDelay={500}>
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => {}} disabled>
              <FilePlusIcon size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="New Scratch Folder" openDelay={500}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={() => {
                console.log('TODO - implement scratch folders');
              }}
              disabled
            >
              <FolderPlusIcon size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="New Linked Folder" openDelay={500}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={() => openFileTab({ id: 'add-table', type: 'add-table', title: 'New Linked Folder', path: '' })}
            >
              <FolderSyncIcon size={14} />
            </ActionIcon>
          </Tooltip>

          <Box w={1} h={16} bg="var(--fg-divider)" mx={4} />

          <Tooltip label="Collapse All" openDelay={500}>
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={collapseAllGroups}>
              <CopyMinusIcon size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Expand All" openDelay={500}>
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={expandAllGroups}>
              <CopyPlusIcon size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <ScrollArea className={styles.container}>
        <Stack gap={0}>
          {sortedGroups.map((group) => (
            <DataFolderGroupItem
              key={group.name}
              group={group}
              isExpanded={expandedGroups.has(group.name)}
              onToggle={() => toggleGroup(group.name)}
              selectedFolderId={selectedFolderId}
              onFolderClick={handleFolderClick}
              onFolderDelete={handleFolderDelete}
            />
          ))}
        </Stack>
      </ScrollArea>

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
    </Stack>
  );
}

interface DataFolderItemProps {
  folder: DataFolder;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
}

function DataFolderItem({ folder, isSelected, onClick, onDelete }: DataFolderItemProps) {
  const [menuOpened, setMenuOpened] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const handleContextMenu = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setMenuOpened(true);
  };

  const handleNewFile = () => {
    console.log('New File clicked for folder:', folder.id);
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
          <Menu.Item leftSection={<FilePlusIcon size={16} />} onClick={handleNewFile} disabled>
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
}

function DataFolderGroupItem({
  group,
  isExpanded,
  onToggle,
  selectedFolderId,
  onFolderClick,
  onFolderDelete,
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
