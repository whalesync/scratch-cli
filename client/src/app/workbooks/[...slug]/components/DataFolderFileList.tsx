'use client';

import { TextMono12Regular } from '@/app/components/base/text';
import { ErrorInfo } from '@/app/components/InfoPanel';
import { LoaderWithMessage } from '@/app/components/LoaderWithMessage';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { filesApi } from '@/lib/api/files';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { ActionIcon, Box, Button, Center, Group, LoadingOverlay, Menu, Modal, Stack, Text } from '@mantine/core';
import { DataFolderId, FileId, FileRefEntity } from '@spinner/shared-types';
import { FileDiffIcon, FileIcon, FileMinusIcon, FilePlusIcon, RefreshCw, Trash2Icon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useDataFolder } from '../../../../hooks/use-data-folder';
import { useFolderFileList } from '../../../../hooks/use-folder-file-list';
import { ScratchpadNotifications } from '../../../components/ScratchpadNotifications';
import styles from './DataFolderFileList.module.css';

const LOCK_POLL_INTERVAL_MS = 1000;

interface DataFolderFileListProps {
  dataFolderId: DataFolderId | null;
}

export const DataFolderFileList = ({ dataFolderId }: DataFolderFileListProps) => {
  const { workbook } = useActiveWorkbook();
  const { dataFolder, isLoading: folderLoading, refresh: refreshFolder } = useDataFolder(dataFolderId);

  const {
    files: fileListData,
    isLoading: filesLoading,
    error,
    refreshFiles,
  } = useFolderFileList(workbook?.id ?? null, dataFolder?.id ?? null);
  const openFileTab = useWorkbookEditorUIStore((state) => state.openFileTab);

  // Context menu state
  const [menuOpened, setMenuOpened] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedFile, setSelectedFile] = useState<FileRefEntity | null>(null);

  // Delete confirmation modal state
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileRefEntity | null>(null);

  const handleFileClick = useCallback(
    (fileId: FileId, fileName: string, filePath: string) => {
      openFileTab({ id: fileId, type: 'file', title: fileName, path: filePath });
    },
    [openFileTab],
  );

  const handleContextMenu = useCallback((e: MouseEvent<HTMLDivElement>, file: FileRefEntity) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setSelectedFile(file);
    setMenuOpened(true);
  }, []);

  const handleDeleteClick = useCallback(() => {
    if (selectedFile) {
      setFileToDelete(selectedFile);
      setDeleteModalOpened(true);
    }
    setMenuOpened(false);
  }, [selectedFile]);

  const handleDeleteConfirm = useCallback(async () => {
    if (fileToDelete && workbook) {
      try {
        await filesApi.deleteFileByPath(workbook.id, fileToDelete.path);
        refreshFiles();
        ScratchpadNotifications.success({
          message: `File ${fileToDelete.name} deleted`,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        ScratchpadNotifications.error({
          title: `Failed to delete file ${fileToDelete.name}`,
          message: errorMessage,
        });
      }
    }
    setDeleteModalOpened(false);
    setFileToDelete(null);
  }, [fileToDelete, workbook, refreshFiles]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteModalOpened(false);
    setFileToDelete(null);
  }, []);

  // Track previous lock state to detect transitions
  const prevLockRef = useRef(dataFolder?.lock);

  // Poll for folder updates while download is in progress
  useEffect(() => {
    // Check if lock transitioned from 'download' to null
    if (prevLockRef.current === 'download' && dataFolder?.lock === null) {
      refreshFiles();
    }
    prevLockRef.current = dataFolder?.lock;
  }, [dataFolder?.lock, refreshFiles]);

  useEffect(() => {
    if (dataFolder?.lock !== 'download') {
      return;
    }

    const intervalId = setInterval(() => {
      refreshFolder();
    }, LOCK_POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [dataFolder?.lock, refreshFolder]);

  // Filter to only file items and sort alphabetically
  const sortedFiles = useMemo(() => {
    const items = fileListData ?? [];
    return items
      .filter((item): item is FileRefEntity => item.type === 'file')
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [fileListData]);

  const renderFileItem = (file: FileRefEntity) => {
    let icon = <FileIcon size={16} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />;

    if (file.status === 'modified') {
      icon = <FileDiffIcon size={16} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />;
    } else if (file.status === 'deleted') {
      icon = <FileMinusIcon size={16} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />;
    } else if (file.status === 'created') {
      icon = <FilePlusIcon size={16} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />;
    }

    return (
      <Group
        key={file.id}
        className={styles.fileItem}
        onClick={() => handleFileClick(file.id, file.name, file.path)}
        onContextMenu={(e) => handleContextMenu(e, file)}
        wrap="nowrap"
        gap="sm"
      >
        {icon}
        <TextMono12Regular
          c="var(--fg-primary)"
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {file.name}
        </TextMono12Regular>
      </Group>
    );
  };

  if (error) {
    return (
      <Center h="100%">
        <ErrorInfo title="Error loading folder contents" description={error instanceof Error ? error.message : error} />
      </Center>
    );
  }

  if (folderLoading || (filesLoading && !fileListData)) {
    return (
      <Center h="100%">
        <LoaderWithMessage message="Loading folder details..." centered />
      </Center>
    );
  }

  return (
    <Stack h="100%" w="100%" gap={0} style={{ position: 'relative' }}>
      <LoadingOverlay
        visible={dataFolder?.lock === 'download'}
        zIndex={1000}
        overlayProps={{ radius: 'sm', blur: 2 }}
        loaderProps={{ children: 'Download in progress...' }}
      />

      {/* Scrollable file list */}
      <Box className={styles.fileListContainer}>
        {sortedFiles.length === 0 ? (
          <Center h="100%" c="var(--fg-secondary)">
            <TextMono12Regular>No files in this folder</TextMono12Regular>
          </Center>
        ) : (
          sortedFiles.map((file) => renderFileItem(file))
        )}
      </Box>

      {/* Footer */}
      <Group className={styles.footer} justify="space-between">
        <Group gap="xs">
          <ActionIcon variant="subtle" size="sm" onClick={() => refreshFiles()}>
            <RefreshCw size={14} />
          </ActionIcon>
        </Group>

        <TextMono12Regular c="var(--fg-secondary)">
          {sortedFiles.length} {sortedFiles.length === 1 ? 'file' : 'files'}
        </TextMono12Regular>
      </Group>

      {/* Context Menu */}
      <Menu opened={menuOpened} onChange={setMenuOpened} position="bottom-start" withinPortal>
        <Menu.Target>
          <Box style={{ position: 'fixed', top: menuPosition.y, left: menuPosition.x, width: 0, height: 0 }} />
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<Trash2Icon size={16} />} color="red" onClick={handleDeleteClick}>
            Delete
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {/* Delete Confirmation Modal */}
      <Modal opened={deleteModalOpened} onClose={handleDeleteCancel} title="Delete File" size="sm" centered>
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to delete &quot;{fileToDelete?.name}&quot;? This action cannot be undone.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" color="gray" onClick={handleDeleteCancel}>
              Cancel
            </Button>
            <Button color="red" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};
