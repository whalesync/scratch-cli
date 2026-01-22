'use client';

import { IconButtonOutline } from '@/app/components/base/buttons';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useFile } from '@/hooks/use-file';
import { useFileList } from '@/hooks/use-file-list';
import { customWebflowActionsApi } from '@/lib/api/custom-actions/webflow';
import { foldersApi } from '@/lib/api/files';
import { markdown } from '@codemirror/lang-markdown';
import { unifiedMergeView } from '@codemirror/merge';
import { EditorView } from '@codemirror/view';
import { Box, Button, Group, Modal, Select, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import type { FileId, FolderRefEntity, WorkbookId } from '@spinner/shared-types';
import { Service } from '@spinner/shared-types';
import CodeMirror from '@uiw/react-codemirror';
import DOMPurify from 'dompurify';
import matter from 'gray-matter';
import { CheckCircleIcon, DownloadIcon, EyeIcon, SaveIcon, TextAlignEndIcon, TextAlignJustifyIcon } from 'lucide-react';
import htmlParser from 'prettier/plugins/html';
import prettier from 'prettier/standalone';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ViewMode = 'original' | 'original-current' | 'current' | 'current-suggested' | 'suggested';

interface FileEditorProps {
  workbookId: WorkbookId;
  fileId: FileId | null;
}

export function FileEditor({ workbookId, fileId }: FileEditorProps) {
  const { file: fileResponse, isLoading, updateFile } = useFile(workbookId, fileId);
  const { files: allItems } = useFileList(workbookId);
  const [content, setContent] = useState<string>('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('current');

  // Find the parent folder and check if it's a Webflow connector
  const parentFolder = useMemo(() => {
    if (!fileResponse?.file?.ref?.parentFolderId || !allItems?.items) return null;
    return allItems.items.find(
      (item): item is FolderRefEntity =>
        item.type === 'folder' && item.id === fileResponse.file.ref.parentFolderId
    ) ?? null;
  }, [fileResponse, allItems]);

  const isWebflowFile = parentFolder?.connectorService === Service.WEBFLOW && !!parentFolder?.snapshotTableId;

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

  const handleValidate = useCallback(async () => {
    if (!fileId || !parentFolder?.snapshotTableId || !content) return;

    setIsValidating(true);
    try {
      // Send the current content directly for validation - no database lookup needed
      const result = await customWebflowActionsApi.validateFiles({
        snapshotTableId: parentFolder.snapshotTableId,
        files: [
          {
            filename: fileResponse?.file?.ref?.name || fileId,
            id: fileId,
            rawContent: content,
          },
        ],
      });

      const fileResult = result.results[0];
      if (fileResult?.publishable) {
        ScratchpadNotifications.success({
          title: 'Validation Passed',
          message: 'This file is valid and ready to publish.',
        });
      } else if (fileResult?.errors && fileResult.errors.length > 0) {
        ScratchpadNotifications.error({
          title: 'Validation Failed',
          message: fileResult.errors.join('\n'),
          autoClose: false,
        });
      } else {
        ScratchpadNotifications.warning({
          title: 'Validation Result',
          message: 'No validation results returned.',
        });
      }
    } catch (error) {
      console.error('Failed to validate file:', error);
      ScratchpadNotifications.error({
        title: 'Validation Error',
        message: error instanceof Error ? error.message : 'Failed to validate file',
      });
    } finally {
      setIsValidating(false);
    }
  }, [fileId, parentFolder?.snapshotTableId, content, fileResponse?.file?.ref?.name]);

  // Content formatting (Preview, Prettify, Minify) - same logic as HtmlActionButtons
  const [previewOpened, { open: openPreview, close: closePreview }] = useDisclosure(false);

  // Check if content editing is allowed in current view mode
  const isEditable = viewMode === 'current' || viewMode === 'original-current' || viewMode === 'current-suggested';

  // Extract the body content (after front matter) for preview
  const bodyContent = useMemo(() => {
    try {
      const parsed = matter(content);
      return parsed.content || '';
    } catch {
      return content;
    }
  }, [content]);

  const handlePrettifyBody = useCallback(async () => {
    if (!isEditable) {
      return;
    }
    try {
      const parsed = matter(content);
      const formatted = await prettier.format(parsed.content || '', {
        parser: 'html',
        plugins: [htmlParser],
        printWidth: 80,
        tabWidth: 2,
      });
      const result = matter.stringify(formatted.trim(), parsed.data);
      setContent(result);
      setHasChanges(true);
    } catch {
      // If formatting fails, leave as-is
    }
  }, [content, isEditable]);

  const handleMinifyBody = useCallback(() => {
    if (!isEditable) {
      return;
    }
    try {
      const parsed = matter(content);
      const minified = (parsed.content || '')
        .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
        .replace(/\s+/g, ' ') // Collapse whitespace
        .replace(/>\s+</g, '><') // Remove whitespace between tags
        .replace(/\s+>/g, '>') // Remove whitespace before closing >
        .replace(/<\s+/g, '<') // Remove whitespace after opening <
        .trim();
      const result = matter.stringify(minified, parsed.data);
      setContent(result);
      setHasChanges(true);
    } catch {
      // If minifying fails, leave as-is
    }
  }, [content, isEditable]);

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
    <>
      {/* HTML Preview Modal - shows only body content (after front matter) */}
      <Modal opened={previewOpened} onClose={closePreview} title="HTML Preview" size="xl" centered>
        <iframe
          srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:8px;font-family:system-ui,sans-serif;">${DOMPurify.sanitize(bodyContent)}</body></html>`}
          style={{ width: '100%', height: 400, border: 'none' }}
          sandbox="allow-same-origin"
          title="HTML Preview"
        />
      </Modal>

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
          <Group gap="xs">
            <Select
              size="xs"
              w={200}
              value={viewMode}
              onChange={(value) => setViewMode(value as ViewMode)}
              data={viewModeOptionsWithState}
            />
            {/* Content formatting buttons - same as HtmlActionButtons */}
            <Group gap={4}>
              <Tooltip label="Preview body content" position="bottom" withArrow>
                <IconButtonOutline size="compact-xs" onClick={openPreview}>
                  <EyeIcon size={13} />
                </IconButtonOutline>
              </Tooltip>
              <Tooltip label="Prettify body content" position="bottom" withArrow>
                <IconButtonOutline size="compact-xs" onClick={handlePrettifyBody} disabled={!isEditable}>
                  <TextAlignEndIcon size={13} />
                </IconButtonOutline>
              </Tooltip>
              <Tooltip label="Minify body content" position="bottom" withArrow>
                <IconButtonOutline size="compact-xs" onClick={handleMinifyBody} disabled={!isEditable}>
                  <TextAlignJustifyIcon size={13} />
                </IconButtonOutline>
              </Tooltip>
            </Group>
          </Group>
          <Group gap="xs">
            {isWebflowFile && (
              <Button
                size="compact-xs"
                variant="subtle"
                leftSection={<CheckCircleIcon size={12} />}
                onClick={handleValidate}
                loading={isValidating}
              >
                Validate
              </Button>
            )}
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
    </>
  );
}
