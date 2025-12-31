'use client';

import { useFile } from '@/hooks/use-file';
import { Box, Button, Group, Text } from '@mantine/core';
import type { WorkbookId } from '@spinner/shared-types';
import { SaveIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';

interface FileEditorProps {
  workbookId: WorkbookId;
  filePath: string | null;
}

export function FileEditor({ workbookId, filePath }: FileEditorProps) {
  const { file: fileResponse, isLoading, updateFile } = useFile(workbookId, filePath);
  const [content, setContent] = useState<string>('');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Update local content when file loads or changes
  useEffect(() => {
    if (fileResponse?.file?.content !== undefined) {
      setContent(fileResponse.file.content ?? '');
      setHasChanges(false);
    }
  }, [fileResponse]);

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!filePath || !hasChanges) return;

    setIsSaving(true);
    try {
      await updateFile({ content });
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save file:', error);
    } finally {
      setIsSaving(false);
    }
  }, [filePath, hasChanges, content, updateFile]);

  if (!filePath) {
    return (
      <Box p="xl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Text c="dimmed">Select a file to view content</Text>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box p="xl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Text c="dimmed">Loading file...</Text>
      </Box>
    );
  }

  if (!fileResponse) {
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
        justify="flex-end"
        style={{
          borderBottom: '0.5px solid var(--fg-divider)',
          flexShrink: 0,
        }}
      >
        {hasChanges && (
          <Button size="compact-xs" leftSection={<SaveIcon size={12} />} onClick={handleSave} loading={isSaving}>
            Save
          </Button>
        )}
      </Group>

      {/* CodeMirror markdown editor */}
      <Box style={{ flex: 1, overflow: 'auto' }}>
        <CodeMirror
          value={content}
          onChange={handleContentChange}
          extensions={[markdown()]}
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
            fontSize: '14px',
            height: '100%',
            border: 'none',
          }}
        />
      </Box>
    </Box>
  );
}
