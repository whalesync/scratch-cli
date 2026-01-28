'use client';

import { TextMono12Regular } from '@/app/components/base/text';
import { ErrorInfo } from '@/app/components/InfoPanel';
import { LoaderWithMessage } from '@/app/components/LoaderWithMessage';
import { useDataFolderFiles } from '@/hooks/use-data-folder-files';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import {
  ActionIcon,
  Box,
  Button,
  Center,
  Group,
  LoadingOverlay,
  Menu,
  Modal,
  Select,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { DataFolderFileRef, DataFolderId, FileId } from '@spinner/shared-types';
import { ChevronLeft, ChevronRight, FileIcon, FileMinusIcon, RefreshCw, Trash2Icon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { useDataFolder } from '../../../../hooks/use-data-folder';
import { ScratchpadNotifications } from '../../../components/ScratchpadNotifications';
import styles from './DataFolderFileList.module.css';

const LOCK_POLL_INTERVAL_MS = 1000;
const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
  { value: '500', label: '500' },
];
const DEFAULT_PAGE_SIZE = 50;

interface DataFolderFileListProps {
  dataFolderId: DataFolderId | null;
}

export const DataFolderFileList = ({ dataFolderId }: DataFolderFileListProps) => {
  const { dataFolder, isLoading: folderLoading, refresh: refreshFolder } = useDataFolder(dataFolderId);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState(0);

  const offset = currentPage * pageSize;
  const {
    files,
    totalCount,
    isLoading: filesLoading,
    error,
    refresh: refreshFiles,
    deleteFile,
  } = useDataFolderFiles(dataFolderId, pageSize, offset);
  const openFileTab = useWorkbookEditorUIStore((state) => state.openFileTab);

  const totalPages = Math.ceil(totalCount / pageSize);
  const hasNextPage = currentPage < totalPages - 1;
  const hasPrevPage = currentPage > 0;

  // Context menu state
  const [menuOpened, setMenuOpened] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedFile, setSelectedFile] = useState<DataFolderFileRef | null>(null);

  // Delete confirmation modal state
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<DataFolderFileRef | null>(null);

  // Reset to first page when folder changes
  useEffect(() => {
    setCurrentPage(0);
  }, [dataFolderId]);

  // Reset to first page if current page becomes invalid after page size change
  useEffect(() => {
    if (currentPage >= totalPages && totalPages > 0) {
      setCurrentPage(totalPages - 1);
    }
  }, [currentPage, totalPages]);

  const handleFileClick = useCallback(
    (fileId: FileId, fileName: string, filePath: string) => {
      openFileTab({ id: fileId, type: 'file', title: fileName, path: filePath });
    },
    [openFileTab],
  );

  const handleContextMenu = useCallback((e: MouseEvent<HTMLDivElement>, file: DataFolderFileRef) => {
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
    if (fileToDelete) {
      try {
        await deleteFile(fileToDelete.fileId);
        ScratchpadNotifications.success({
          message: `File ${fileToDelete.filename} deleted`,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        ScratchpadNotifications.error({
          title: `Failed to delete file ${fileToDelete.filename}`,
          message: errorMessage,
        });
      }
    }
    setDeleteModalOpened(false);
    setFileToDelete(null);
  }, [fileToDelete, deleteFile]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteModalOpened(false);
    setFileToDelete(null);
  }, []);

  const handlePageSizeChange = (value: string | null) => {
    if (value) {
      setPageSize(parseInt(value, 10));
      setCurrentPage(0);
    }
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (hasPrevPage) {
      setCurrentPage((prev) => prev - 1);
    }
  };

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

  // Sort files alphabetically
  const sortedFiles = [...files].sort((a, b) => a.filename.localeCompare(b.filename));

  if (error) {
    return (
      <Center h="100%">
        <ErrorInfo title="Error loading folder contents" description={error.message} />
      </Center>
    );
  }

  if (folderLoading || (filesLoading && files.length === 0)) {
    return (
      <Center h="100%">
        <LoaderWithMessage message="Loading folder details..." centered />
      </Center>
    );
  }

  const startItem = totalCount === 0 ? 0 : offset + 1;
  const endItem = Math.min(offset + pageSize, totalCount);

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
          sortedFiles.map((file) => (
            <Group
              key={file.fileId}
              className={styles.fileItem}
              onClick={() => handleFileClick(file.fileId, file.filename, file.path)}
              onContextMenu={(e) => handleContextMenu(e, file)}
              wrap="nowrap"
              gap="sm"
            >
              {file.deleted ? (
                <Tooltip label="File is marked for deletion" withArrow>
                  <FileMinusIcon size={16} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />
                </Tooltip>
              ) : (
                <FileIcon size={16} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />
              )}
              <TextMono12Regular
                c="var(--fg-primary)"
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {file.filename}
              </TextMono12Regular>
            </Group>
          ))
        )}
      </Box>

      {/* Footer with pagination controls */}
      <Group className={styles.footer} justify="space-between">
        <Group gap="xs">
          <ActionIcon variant="subtle" size="sm" onClick={() => refreshFiles()}>
            <RefreshCw size={14} />
          </ActionIcon>
          <Select
            size="xs"
            w={70}
            value={String(pageSize)}
            onChange={handlePageSizeChange}
            data={PAGE_SIZE_OPTIONS}
            withCheckIcon={false}
          />
        </Group>

        <Group gap="xs">
          <TextMono12Regular c="var(--fg-secondary)">
            {startItem}-{endItem} of {totalCount}
          </TextMono12Regular>
          <ActionIcon variant="subtle" size="sm" onClick={handlePrevPage} disabled={!hasPrevPage}>
            <ChevronLeft size={14} />
          </ActionIcon>
          <ActionIcon variant="subtle" size="sm" onClick={handleNextPage} disabled={!hasNextPage}>
            <ChevronRight size={14} />
          </ActionIcon>
        </Group>
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
            Are you sure you want to delete &quot;{fileToDelete?.filename}&quot;? This action cannot be undone.
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
