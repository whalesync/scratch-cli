'use client';

import { useFile } from '@/hooks/use-file';
import { foldersApi } from '@/lib/api/files';
import { markdown } from '@codemirror/lang-markdown';
import { unifiedMergeView } from '@codemirror/merge';
import { EditorView } from '@codemirror/view';
import { Box, Button, Group, Select, Text } from '@mantine/core';
import type { FileId, WorkbookId } from '@spinner/shared-types';
import CodeMirror from '@uiw/react-codemirror';
import { DownloadIcon, SaveIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ViewMode = 'original' | 'original-current' | 'current' | 'current-suggested' | 'suggested';

interface FileEditorProps {
  workbookId: WorkbookId;
  fileId: FileId | null;
}

export function FileEditor({ workbookId, fileId }: FileEditorProps) {
  const { file: fileResponse, isLoading, updateFile } = useFile(workbookId, fileId);
  const [content, setContent] = useState<string>('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('current');

  const originalContent = fileResponse?.file?.originalContent ?? '';
  const suggestedContent = fileResponse?.file?.suggestedContent ?? '';

  // Build view mode options with disabled state based on available data
  const viewModeOptionsWithState = useMemo(() => {
    return [
      { value: 'original', label: 'Original (read-only)', disabled: !originalContent },
      { value: 'original-current', label: 'Original <> Current', disabled: !originalContent },
      { value: 'current', label: 'Current', disabled: false },
      { value: 'current-suggested', label: 'Current <> Suggested', disabled: !suggestedContent },
      { value: 'suggested', label: 'Suggested (read-only)', disabled: !suggestedContent },
    ];
  }, [originalContent, suggestedContent]);

  // Reset view mode if current mode becomes unavailable
  useEffect(() => {
    const currentOption = viewModeOptionsWithState.find((m) => m.value === viewMode);
    if (currentOption?.disabled) {
      setViewMode('current');
    }
  }, [viewModeOptionsWithState, viewMode]);

  // Update local content when file loads or changes
  useEffect(() => {
    if (fileResponse?.file?.content !== undefined) {
      setContent(fileResponse.file.content ?? '');
      setHasChanges(false);
    }
  }, [fileResponse]);

  const handleContentChange = useCallback(
    (newContent: string) => {
      // Only allow changes in editable modes
      if (viewMode === 'current' || viewMode === 'original-current' || viewMode === 'current-suggested') {
        setContent(newContent);
        setHasChanges(true);
      }
    },
    [viewMode],
  );

  const handleSave = useCallback(async () => {
    if (!fileId || !hasChanges) return;

    setIsSaving(true);
    try {
      await updateFile({ content });
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save file:', error);
    } finally {
      setIsSaving(false);
    }
  }, [fileId, hasChanges, content, updateFile]);

  const handleDownload = useCallback(() => {
    if (!fileId) return;
    foldersApi.downloadFile(workbookId, fileId);
  }, [workbookId, fileId]);

  const extensions = useMemo(() => {
    switch (viewMode) {
      case 'original':
        return [markdown(), EditorView.editable.of(false)];

      case 'original-current':
        // In this mode, original is the base and current is the edited version
        // Accept button reverts the chunk back to original
        return [
          markdown(),
          unifiedMergeView({
            original: originalContent,
            mergeControls: true,
            highlightChanges: true,
          }),
        ];

      case 'current':
        return [markdown()];

      case 'current-suggested':
        return [
          markdown(),
          unifiedMergeView({
            original: content,
            mergeControls: true,
            highlightChanges: true,
          }),
        ];

      case 'suggested':
        return [markdown(), EditorView.editable.of(false)];

      default:
        return [markdown()];
    }
  }, [viewMode, originalContent, content]);

  const editorValue = useMemo(() => {
    switch (viewMode) {
      case 'original':
        return originalContent;
      case 'original-current':
        return content;
      case 'current':
        return content;
      case 'current-suggested':
        return suggestedContent;
      case 'suggested':
        return suggestedContent;
      default:
        return content;
    }
  }, [viewMode, originalContent, content, suggestedContent]);

  // Force re-mount when switching modes that change the diff base
  const editorKey = useMemo(() => {
    return `${viewMode}-${viewMode === 'current-suggested' ? content.length : 0}`;
  }, [viewMode, content]);

  if (!fileId) {
    return (
      <Box p="xl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Text c="dimmed">Select a file to view content</Text>
      </Box>
    );
  }

  // Don't show full page loader if we are just saving changes
  if (isLoading && !fileResponse && !isSaving) {
    return (
      <Box p="xl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Text c="dimmed">Loading file...</Text>
      </Box>
    );
  }

  if (!fileResponse && !isSaving) {
    return (
      <Box p="xl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Text c="dimmed">File not found</Text>
      </Box>
    );
  }

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <Group
        h={32}
        px="xs"
        justify="space-between"
        style={{
          borderBottom: '0.5px solid var(--fg-divider)',
          flexShrink: 0,
        }}
      >
        <Select
          size="xs"
          w={200}
          value={viewMode}
          onChange={(value) => setViewMode(value as ViewMode)}
          data={viewModeOptionsWithState}
        />
        <Group gap="xs">
          <Button size="compact-xs" variant="subtle" leftSection={<DownloadIcon size={12} />} onClick={handleDownload}>
            Download
          </Button>
          {hasChanges && (
            <Button size="compact-xs" leftSection={<SaveIcon size={12} />} onClick={handleSave} loading={isSaving}>
              Save
            </Button>
          )}
        </Group>
      </Group>

      {/* CodeMirror markdown editor */}
      <Box
        className={viewMode === 'original-current' ? 'hide-accept-button' : undefined}
        style={{ flex: 1, overflow: 'auto' }}
      >
        <style>{`
          .hide-accept-button .cm-deletedChunk .cm-chunkButtons button[name="accept"] {
            display: none;
          }
        `}</style>
        <CodeMirror
          key={editorKey}
          value={editorValue}
          onChange={handleContentChange}
          extensions={extensions}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            history: true,
            foldGutter: true,
            drawSelection: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            syntaxHighlighting: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightActiveLine: viewMode === 'current' || viewMode === 'original-current',
            highlightSelectionMatches: true,
            closeBracketsKeymap: true,
            defaultKeymap: true,
            searchKeymap: true,
            historyKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true,
          }}
          style={{
            fontSize: '14px',
            height: '100%',
            border: 'none',
          }}
        />
      </Box>
    </Box>
  );
}
