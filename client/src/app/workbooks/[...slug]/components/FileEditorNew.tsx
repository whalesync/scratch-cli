'use client';

import { IconButtonOutline } from '@/app/components/base/buttons';
import { MergeEditor } from '@/app/workbooks/[...slug]/components/MergeEditor';
import { json } from '@codemirror/lang-json';
import { unifiedMergeView } from '@codemirror/merge';
import { EditorView } from '@codemirror/view';
import { Box, Button, Group, Modal, Select, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import type { WorkbookId } from '@spinner/shared-types';
import CodeMirror from '@uiw/react-codemirror';
import DOMPurify from 'dompurify';
import matter from 'gray-matter';
import { EyeIcon, SaveIcon, TextAlignEndIcon, TextAlignJustifyIcon } from 'lucide-react';
import htmlParser from 'prettier/plugins/html';
import prettier from 'prettier/standalone';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFileByPath } from '../../../../hooks/use-file-path';

type ViewMode = 'original' | 'original-current' | 'original-current-split' | 'current';

interface FileEditorNewProps {
  workbookId: WorkbookId;
  filePath: string | null;
  initialViewMode?: ViewMode;
}

export function FileEditorNew({ workbookId, filePath, initialViewMode }: FileEditorNewProps) {
  const { file: fileResponse, isLoading, updateFile } = useFileByPath(workbookId, filePath);

  // Editor content states
  const [content, setContent] = useState<string>('');
  const [savedContent, setSavedContent] = useState<string>('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode || 'current');

  const originalContent = fileResponse?.file?.originalContent ?? '';

  // Handle view mode switching logic
  // 1. If initialViewMode prop changes, prefer that.
  useEffect(() => {
    if (initialViewMode) {
      setViewMode(initialViewMode);
    }
  }, [initialViewMode, filePath]); // Re-evaluate when file changes too

  // 2. Validate view mode feasibility (e.g. can't show diff if no original content)
  const canShowDiff = !!originalContent;
  useEffect(() => {
    if (!isLoading && !canShowDiff && viewMode.startsWith('original')) {
      // If loaded and requested diff but can't show it, fallback to current
      setViewMode('current');
    }
  }, [isLoading, canShowDiff, viewMode]);

  const viewModeOptions = useMemo(() => {
    return [
      { value: 'current', label: 'Current', disabled: false },
      { value: 'original-current-split', label: 'Diff (side-by-side)', disabled: !canShowDiff },
      { value: 'original-current', label: 'Diff (unified)', disabled: !canShowDiff },
      { value: 'original', label: 'Original (read-only)', disabled: !canShowDiff },
    ];
  }, [canShowDiff]);

  const handleContentChange = useCallback(
    (newContent: string) => {
      // Allow editing in all modes except original-only (read-only)
      if (viewMode === 'original') return;

      setContent(newContent);
      setHasChanges(newContent !== savedContent);
    },
    [viewMode, savedContent],
  );

  const handleSave = useCallback(async () => {
    if (!filePath || !hasChanges) return;

    setIsSaving(true);
    try {
      await updateFile({ content });
      setSavedContent(content);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save file:', error);
    } finally {
      setIsSaving(false);
    }
  }, [filePath, hasChanges, content, updateFile]);

  // Content formatting (Preview, Prettify, Minify)
  const [previewOpened, { open: openPreview, close: closePreview }] = useDisclosure(false);
  const isEditable = viewMode !== 'original';

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
    if (!isEditable) return;
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
      setHasChanges(result !== savedContent);
    } catch {
      // If formatting fails, leave as-is
    }
  }, [content, isEditable, savedContent]);

  const handleMinifyBody = useCallback(() => {
    if (!isEditable) return;
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
      setHasChanges(result !== savedContent);
    } catch {
      // If minifying fails, leave as-is
    }
  }, [content, isEditable, savedContent]);

  const extensions = useMemo(() => {
    switch (viewMode) {
      case 'original':
        return [json(), EditorView.editable.of(false)];

      case 'original-current':
        // In this mode, original is the base and current is the edited version
        // Accept button reverts the chunk back to original
        return [
          json(),
          unifiedMergeView({
            original: originalContent,
            mergeControls: true,
            highlightChanges: true,
          }),
        ];

      case 'current':
        return [json()];

      default:
        return [json()];
    }
  }, [viewMode, originalContent]);

  const editorValue = useMemo(() => {
    switch (viewMode) {
      case 'original':
        return originalContent;
      case 'original-current':
        return content;
      case 'current':
        return content;
      default:
        return content;
    }
  }, [viewMode, originalContent, content]);

  // Force re-mount when switching modes that change the diff base
  const editorKey = useMemo(() => {
    return `${viewMode}-0`;
  }, [viewMode]);

  /* 
     Fix for focus loss and diff collapsing:
     1. We need to key the MergeEditor by the content length to force a re-mount when the file FIRST loads.
        This ensures MergeView is constructed with the full text, allowing 'collapseUnchanged' to calc correctly.
     2. We must NOT use dynamic content.length in the key, or it will remount on every keystroke, losing focus.
     3. Solution: Capture the length ONLY when the file is first initialized/loaded.
  */
  const [initialContentLength, setInitialContentLength] = useState<number | 0>(0);

  // Initialize content from file response
  const [isContentInitialized, setIsContentInitialized] = useState(false);

  useEffect(() => {
    if (fileResponse?.file?.content !== undefined) {
      const fileContent = fileResponse.file.content ?? '';
      setContent(fileContent);
      setSavedContent(fileContent);
      setHasChanges(false);
      setInitialContentLength(fileContent.length);
      setIsContentInitialized(true);
    }
  }, [fileResponse]);

  if (!filePath) {
    return (
      <Box p="xl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Text c="dimmed">Select a folder to view content</Text>
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

  if ((!fileResponse && !isSaving) || !isContentInitialized) {
    if (!isContentInitialized && isLoading) {
      return (
        <Box p="xl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Text c="dimmed">Loading file...</Text>
        </Box>
      );
    }
    if (!fileResponse && !isSaving && !isLoading) {
      return (
        <Box p="xl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Text c="dimmed">File not found</Text>
        </Box>
      );
    }
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
              data={viewModeOptions}
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
              highlightActiveLine: isEditable,
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
              // Hide this editor when in split mode
              display: viewMode.endsWith('-split') ? 'none' : 'block',
            }}
          />

          {/* Merge Editor for split view */}
          {/* We key the MergeEditor by originalContent length and the INITIAL content length.
              This forces a correct first render for collapsing, but keeps the component stable
              during subsequent editing (preventing focus loss). */}
          {viewMode === 'original-current-split' && (
            <MergeEditor
              key={`split-${originalContent?.length ?? 0}-${initialContentLength}`}
              original={originalContent}
              modified={content}
              onModifiedChange={handleContentChange}
            />
          )}
        </Box>
      </Box>
    </>
  );
}
