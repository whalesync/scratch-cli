'use client';

import { Text13Regular, TextMono12Regular } from '@/app/components/base/text';
import { useFileByPath } from '@/hooks/use-file-path';
import { json } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import { Badge, Box, Button, Group, Stack, useMantineColorScheme } from '@mantine/core';
import type { WorkbookId } from '@spinner/shared-types';
import CodeMirror from '@uiw/react-codemirror';
import { SaveIcon } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface FileViewerProps {
  workbookId: WorkbookId;
  filePath: string;
}

export function FileViewer({ workbookId, filePath }: FileViewerProps) {
  const { file: fileResponse, isLoading, updateFile } = useFileByPath(workbookId, filePath);
  const { colorScheme } = useMantineColorScheme();

  // Editor content states
  const [content, setContent] = useState<string>('');
  const [savedContent, setSavedContent] = useState<string>('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isContentInitialized, setIsContentInitialized] = useState(false);

  // Initialize content from file response
  useEffect(() => {
    if (fileResponse?.file?.content !== undefined) {
      const fileContent = fileResponse.file.content ?? '';
      setContent(fileContent);
      setSavedContent(fileContent);
      setHasChanges(false);
      setIsContentInitialized(true);
    }
  }, [fileResponse]);

  // Reset when file path changes
  useEffect(() => {
    setIsContentInitialized(false);
    setHasChanges(false);
  }, [filePath]);

  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent);
      setHasChanges(newContent !== savedContent);
    },
    [savedContent],
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

  // Keyboard shortcut: Cmd+S / Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const extensions = useMemo(() => {
    return [json(), EditorView.lineWrapping];
  }, []);

  // Extract filename from path
  const fileName = useMemo(() => {
    const parts = filePath.split('/');
    return parts[parts.length - 1] || filePath;
  }, [filePath]);

  // Determine if file is modified (check dirty flag from endpoint)
  const isModified = fileResponse?.file?.ref?.dirty === true;

  if (!filePath) {
    return (
      <Box p="xl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Text13Regular c="dimmed">Select a file to view its contents</Text13Regular>
      </Box>
    );
  }

  if (isLoading && !isContentInitialized) {
    return (
      <Box p="xl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Text13Regular c="dimmed">Loading file...</Text13Regular>
      </Box>
    );
  }

  if (!fileResponse && !isSaving && !isLoading) {
    return (
      <Box p="xl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Text13Regular c="dimmed">File not found</Text13Regular>
      </Box>
    );
  }

  return (
    <Stack h="100%" gap={0}>
      {/* File header */}
      <Group
        h={36}
        px="sm"
        justify="space-between"
        style={{
          borderBottom: '0.5px solid var(--fg-divider)',
          flexShrink: 0,
          backgroundColor: 'var(--bg-base)',
        }}
      >
        <Group gap="sm">
          <TextMono12Regular c="var(--fg-primary)">{fileName}</TextMono12Regular>
          {isModified && (
            <Link
              href={`/workbook/${workbookId}/review/${filePath}`}
              style={{ textDecoration: 'none' }}
            >
              <Badge size="xs" variant="light" color="yellow" style={{ cursor: 'pointer' }}>
                Edited
              </Badge>
            </Link>
          )}
          {hasChanges && (
            <Badge size="xs" variant="light" color="blue">
              Unsaved
            </Badge>
          )}
        </Group>

        <Group gap="xs">
          {hasChanges && (
            <Button
              size="compact-xs"
              leftSection={<SaveIcon size={12} />}
              onClick={handleSave}
              loading={isSaving}
            >
              Save
            </Button>
          )}
        </Group>
      </Group>

      {/* CodeMirror Editor */}
      <Box style={{ flex: 1, overflow: 'auto' }}>
        <CodeMirror
          value={content}
          onChange={handleContentChange}
          extensions={extensions}
          theme={colorScheme === 'dark' ? 'dark' : 'light'}
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
            highlightActiveLine: true,
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
            fontSize: '13px',
            height: '100%',
          }}
        />
      </Box>
    </Stack>
  );
}
