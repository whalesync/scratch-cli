import { useDataFolderPublishStatus } from '@/hooks/use-data-folder-publish-status';
import { Group, Loader, Stack, Text } from '@mantine/core';
import { DataFolderId, WorkbookId } from '@spinner/shared-types';
import pluralize from 'pluralize';
import { FC, useEffect, useMemo, useState } from 'react';
import { ButtonPrimaryLight, ButtonSecondaryOutline } from '../base/buttons';
import { ModalWrapper } from '../ModalWrapper';
import { SelectDataFolderRow } from '../SelectDataFolderRow';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedFolderIds: DataFolderId[]) => void;
  initialSelectedFolderIds?: DataFolderId[];
  title: string;
  workbookId: WorkbookId;
}

export const DataFolderSelectorModal: FC<Props> = (props) => {
  const { isOpen, onClose, onConfirm, initialSelectedFolderIds, title, workbookId } = props;
  const [selectedFolderIds, setSelectedFolderIds] = useState<DataFolderId[]>([]);
  const { publishStatus, isLoading, error } = useDataFolderPublishStatus(workbookId);

  const foldersWithChanges = useMemo(() => {
    if (!publishStatus) return [];
    return publishStatus.filter((folder) => folder.hasChanges || folder.lock);
  }, [publishStatus]);

  // Initialize selection when foldersWithChanges changes
  useEffect(() => {
    if (foldersWithChanges.length > 0) {
      // If initialSelectedFolderIds provided, use those (filter to only available folders)
      if (initialSelectedFolderIds && initialSelectedFolderIds.length > 0) {
        const validInitialIds = initialSelectedFolderIds.filter((id) =>
          foldersWithChanges.some((f) => f.folderId === id && !f.lock),
        );
        setSelectedFolderIds(validInitialIds);
      } else {
        // Auto-select all available (non-locked) folders
        const allAvailableIds = foldersWithChanges
          .filter((f) => !f.lock)
          .map((f) => f.folderId);
        setSelectedFolderIds(allAvailableIds);
      }
    }
  }, [foldersWithChanges, initialSelectedFolderIds]);

  const handleConfirm = () => {
    onConfirm(selectedFolderIds);
  };

  const handleClose = () => {
    setSelectedFolderIds([]);
    onClose();
  };

  const toggleFolder = (folderId: string) => {
    setSelectedFolderIds((prev) =>
      prev.includes(folderId as DataFolderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId as DataFolderId],
    );
  };

  const getChangeCount = (folderId: DataFolderId) => {
    if (!publishStatus) return 0;
    const folder = publishStatus.find((f) => f.folderId === folderId);
    if (!folder) return 0;
    return folder.creates + folder.updates + folder.deletes;
  };

  const isPublishInProgress = useMemo(() => {
    return foldersWithChanges.some((f) => f.lock);
  }, [foldersWithChanges]);

  const footer = (
    <Group justify="flex-end">
      <ButtonSecondaryOutline onClick={handleClose}>Cancel</ButtonSecondaryOutline>
      <ButtonPrimaryLight onClick={handleConfirm} disabled={selectedFolderIds.length === 0}>
        Continue
      </ButtonPrimaryLight>
    </Group>
  );

  return (
    <ModalWrapper customProps={{ footer }} opened={isOpen} onClose={handleClose} title={title} centered size="lg">
      <Stack>
        {isPublishInProgress && (
          <Text c="orange" size="sm" fw={500}>
            A publish job is currently in progress. The number of unpublished changes may update as records are
            processed.
          </Text>
        )}

        {isLoading ? (
          <Group justify="center" p="xl">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Checking for changes...
            </Text>
          </Group>
        ) : error ? (
          <Text c="red" size="sm">
            Error checking changes: {error.message}
          </Text>
        ) : foldersWithChanges.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            No data folders with unpublished changes found.
          </Text>
        ) : (
          <Stack gap="xs">
            {foldersWithChanges.map((folder) => {
              const changeCount = getChangeCount(folder.folderId);
              const isPublishing = !!folder.lock;
              const statusText = (
                <Text size="sm" c={isPublishing ? 'orange' : 'blue'}>
                  {isPublishing ? 'Publishing...' : `${changeCount} unpublished ${pluralize('change', changeCount)}`}
                </Text>
              );

              return (
                <SelectDataFolderRow
                  key={folder.folderId}
                  folder={folder}
                  isSelected={selectedFolderIds.includes(folder.folderId)}
                  disabled={isPublishing}
                  onToggle={toggleFolder}
                  statusText={statusText}
                />
              );
            })}
          </Stack>
        )}
      </Stack>
    </ModalWrapper>
  );
};
