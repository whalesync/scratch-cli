'use client';

import { markdown } from '@codemirror/lang-markdown';
import { unifiedMergeView } from '@codemirror/merge';
import { Box, Title } from '@mantine/core';
import CodeMirror from '@uiw/react-codemirror';
import { useMemo } from 'react';

const originalContent = `# Welcome to the Editor

This is the original content.
It has a few lines of text.

Some of this will change.
And some will stay the same.
`;

const suggestedContent = `# Welcome to the Editor

This is the modified content with AI suggestions.
It has a few lines of text.

Some of this has been updated by AI.
And some will stay the same.
A new line was added here.
`;

export default function DemoDiffPage() {
  const extensions = useMemo(
    () => [
      markdown(),
      unifiedMergeView({
        original: originalContent,
        mergeControls: true,
        highlightChanges: true,
      }),
    ],
    []
  );

  return (
    <Box p="xl" style={{ maxWidth: 900, margin: '0 auto' }}>
      <Title order={2} mb="lg">
        CodeMirror Diff Demo
      </Title>
      <Box
        style={{
          border: '1px solid var(--mantine-color-gray-4)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <CodeMirror
          value={suggestedContent}
          extensions={extensions}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            foldGutter: true,
            highlightActiveLine: true,
          }}
          style={{
            fontSize: '14px',
          }}
        />
      </Box>
    </Box>
  );
}
