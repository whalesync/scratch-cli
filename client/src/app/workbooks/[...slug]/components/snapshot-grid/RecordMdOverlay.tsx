'use client';

import { ProcessedSnapshotRecord } from '@/hooks/use-snapshot-table-records';
import { Box, Button, Group, Paper, Stack } from '@mantine/core';
import type { SnapshotTable } from '@spinner/shared-types';
import { WorkbookId } from '@spinner/shared-types';
import { SaveIcon, XIcon } from 'lucide-react';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { RecordMdEditor, RecordMdEditorRef } from './RecordMdEditor';

type Props = {
  width: string;
  workbookId: WorkbookId;
  selectedRecord: ProcessedSnapshotRecord;
  table: SnapshotTable;
  onClose: () => void;
};

export const RecordMdOverlay: FC<Props> = ({ width, workbookId, selectedRecord, table, onClose }) => {
  const [hasChanges, setHasChanges] = useState(false);
  const editorRef = useRef<RecordMdEditorRef>(null);

  const handleSave = useCallback(async () => {
    if (editorRef.current) {
      await editorRef.current.save();
    }
  }, []);

  const handleClose = useCallback(async () => {
    if (hasChanges) {
      await handleSave();
    }
    onClose();
  }, [hasChanges, handleSave, onClose]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        handleClose();
      }

      // Cmd/Ctrl + S to save
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault();
        handleSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose, handleSave]);

  return (
    <Box
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        borderLeft: '0.5px solid var(--fg-divider)',
        backgroundColor: 'var(--bg-base)',
      }}
    >
      <Paper w="100%" h="100%" bdrs={0}>
        <Stack h="100%" gap={0}>
          {/* Header */}
          <Group
            w="100%"
            h={36}
            style={{ borderBottom: '0.5px solid var(--fg-divider)' }}
            align="center"
            justify="space-between"
            px="xs"
          >
            <Button variant="subtle" size="compact-xs" onClick={handleClose} leftSection={<XIcon size={13} />}>
              Close
            </Button>
            <Group gap="xs">
              {hasChanges && (
                <Button
                  variant="filled"
                  size="compact-xs"
                  onClick={handleSave}
                  leftSection={<SaveIcon size={13} />}
                  color="blue"
                >
                  Save
                </Button>
              )}
            </Group>
          </Group>

          {/* Editor */}
          <RecordMdEditor
            ref={editorRef}
            workbookId={workbookId}
            selectedRecord={selectedRecord}
            table={table}
            onHasChangesHelper={setHasChanges}
          />
        </Stack>
      </Paper>
    </Box>
  );
};

export default RecordMdOverlay;
