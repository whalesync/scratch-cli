'use client';

import { ConnectorIcon } from '@/app/components/Icons/ConnectorIcon';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { Text13Medium, Text13Regular } from '@/app/components/base/text';
import { useDataFolders } from '@/hooks/use-data-folders';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import {
  ActionIcon,
  Box,
  Collapse,
  Group,
  Loader,
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
  FilePlusIcon,
  FolderIcon,
  FolderPlusIcon,
  FolderSyncIcon,
  StickyNoteIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './DataFolderBrowser.module.css';

interface DataFolderBrowserProps {
  onFolderSelect?: (folderId: DataFolderId) => void;
}

const SCRATCH_GROUP_NAME = 'Scratch';

export function DataFolderBrowser({ onFolderSelect }: DataFolderBrowserProps) {
  const { dataFolders, isLoading } = useDataFolders();
  const openFileTab = useWorkbookEditorUIStore((state) => state.openFileTab);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedFolderId, setSelectedFolderId] = useState<DataFolderId | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  const expandAllGroups = useCallback(() => {
    setExpandedGroups(new Set(dataFolders.map((g) => g.name)));
  }, [dataFolders]);

  const collapseAllGroups = useCallback(() => {
    setExpandedGroups(new Set());
  }, []);

  // Auto-expand all groups when data loads (only once)
  useEffect(() => {
    if (dataFolders.length > 0 && !hasInitialized) {
      setExpandedGroups(new Set(dataFolders.map((g) => g.name)));
      setHasInitialized(true);
    }
  }, [dataFolders, hasInitialized]);

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

  // Sort groups: Scratch first, then alphabetically by name
  const sortedGroups = useMemo(
    () =>
      [...dataFolders].sort((a, b) => {
        if (a.name === SCRATCH_GROUP_NAME) return -1;
        if (b.name === SCRATCH_GROUP_NAME) return 1;
        return a.name.localeCompare(b.name);
      }),
    [dataFolders],
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
          <Tooltip label="New Folder" openDelay={500}>
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => {}} disabled>
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
            />
          ))}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}

interface DataFolderGroupItemProps {
  group: DataFolderGroup;
  isExpanded: boolean;
  onToggle: () => void;
  selectedFolderId: DataFolderId | null;
  onFolderClick: (folder: DataFolder) => void;
}

function DataFolderGroupItem({
  group,
  isExpanded,
  onToggle,
  selectedFolderId,
  onFolderClick,
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
            <UnstyledButton
              key={folder.id}
              className={`${styles.folderItem} ${selectedFolderId === folder.id ? styles.folderItemSelected : ''}`}
              onClick={() => onFolderClick(folder)}
            >
              <Group gap="xs" wrap="nowrap">
                <StyledLucideIcon Icon={FolderIcon} size="sm" c="var(--fg-secondary)" />
                <Text13Regular className={styles.folderName} truncate>
                  {folder.name}
                </Text13Regular>
              </Group>
            </UnstyledButton>
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
