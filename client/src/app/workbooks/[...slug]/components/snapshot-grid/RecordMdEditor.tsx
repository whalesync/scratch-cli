import { ProcessedSnapshotRecord } from '@/hooks/use-snapshot-table-records';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView } from '@codemirror/view';
import { Box } from '@mantine/core';
import type { SnapshotTable, TableSpec } from '@spinner/shared-types';
import { WorkbookId } from '@spinner/shared-types';
import CodeMirror from '@uiw/react-codemirror';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useUpdateRecordsContext } from '../contexts/update-records-context';
import { mdFmToFields, recordToMdFm } from './md-utils';

type Props = {
  workbookId: WorkbookId;
  selectedRecord: ProcessedSnapshotRecord;
  table: SnapshotTable;
  onHasChangesHelper?: (hasChanges: boolean) => void;
  onSaveComplete?: () => void;
};

export interface RecordMdEditorRef {
  save: () => Promise<void>;
}

export const RecordMdEditor = forwardRef<RecordMdEditorRef, Props>(
  ({ workbookId, selectedRecord, table, onHasChangesHelper, onSaveComplete }, ref) => {
    const { addPendingChange, savePendingChanges } = useUpdateRecordsContext();
    const tableSpec = table.tableSpec as TableSpec;

    // Convert record to MD format
    const initialMdContent = useMemo(() => recordToMdFm(selectedRecord, tableSpec), [selectedRecord, tableSpec]);

    const [mdContent, setMdContent] = useState(initialMdContent);
    const [hasChanges, setHasChanges] = useState(false);

    // Reset content when record changes
    useEffect(() => {
      const newContent = recordToMdFm(selectedRecord, tableSpec);
      setMdContent(newContent);
      setHasChanges(false);
      onHasChangesHelper?.(false);
    }, [selectedRecord, tableSpec, onHasChangesHelper]);

    const handleContentChange = useCallback(
      (value: string) => {
        setMdContent(value);
        setHasChanges(true);
        onHasChangesHelper?.(true);
      },
      [onHasChangesHelper],
    );

    const handleSave = useCallback(async () => {
      if (!hasChanges) return;

      try {
        // Parse the MD content back to fields
        const newFields = mdFmToFields(mdContent, tableSpec);

        // Find which fields have changed - compare against __fields (source of truth for MD view)
        // Fall back to fields for backwards compatibility with records that don't have __fields yet
        const originalFields = selectedRecord.__fields || selectedRecord.fields || {};
        const changedFields: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(newFields)) {
          if (originalFields[key] !== value) {
            changedFields[key] = value;
          }
        }

        if (Object.keys(changedFields).length > 0) {
          // Add pending change for the record
          // The server will handle separating schema fields (for postgres) from extra fields (for __fields only)
          addPendingChange({
            workbookId,
            tableId: table.id,
            operation: {
              op: 'update',
              wsId: selectedRecord.id.wsId,
              data: changedFields,
            },
          });

          // Save immediately
          await savePendingChanges();
        }

        setHasChanges(false);
        onHasChangesHelper?.(false);
        onSaveComplete?.();
      } catch (error) {
        console.error('Failed to save MD changes:', error);
      }
    }, [
      hasChanges,
      mdContent,
      tableSpec,
      selectedRecord,
      addPendingChange,
      workbookId,
      table.id,
      savePendingChanges,
      onHasChangesHelper,
      onSaveComplete,
    ]);

    useImperativeHandle(ref, () => ({
      save: handleSave,
    }));

    const extensions = useMemo(() => [markdown({ codeLanguages: languages }), EditorView.lineWrapping], []);

    const theme = useMemo(
      () =>
        EditorView.theme({
          '&': {
            backgroundColor: 'var(--bg-panel)',
            color: 'var(--fg-primary)',
            fontSize: '13px',
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
            height: '100%',
          },
          '.cm-scroller': {
            overflow: 'auto',
          },
          '.cm-content': {
            caretColor: 'var(--fg-primary)',
            padding: '8px 0',
          },
          '.cm-line': {
            padding: '0 8px',
          },
          '.cm-cursor, .cm-dropCursor': {
            borderLeftColor: 'var(--fg-primary)',
          },
          '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection, .cm-line ::selection':
            {
              backgroundColor: '#ffff00 !important',
            },
          '.cm-selectionBackground': {
            backgroundColor: '#ffff00 !important',
          },
          '.cm-selectionMatch': {
            backgroundColor: 'rgba(255, 255, 0, 0.5) !important',
          },
          '.cm-activeLine': {
            backgroundColor: 'var(--bg-selected)',
          },
          '.cm-gutters': {
            display: 'none',
          },
        }),
      [],
    );

    // Expose Cmd+S inside the editor? The previous overlay did it globally.
    // Ideally, the global listener should still be in the parent if it covers the whole screen,
    // or here if we focused the editor.
    // The overlay had `document.addEventListener('keydown', ...)` which is global.
    // Let's keep the global listener logic in the parent (Overlay or Page) for now to avoid duplication/conflicts.

    return (
      <Box flex={1} style={{ overflow: 'hidden', height: '100%' }}>
        <CodeMirror
          value={mdContent}
          onChange={handleContentChange}
          extensions={extensions}
          theme={theme}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLineGutter: false,
            syntaxHighlighting: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: false,
            highlightActiveLine: true,
            drawSelection: false,
          }}
          style={{
            height: '100%',
            width: '100%',
          }}
          // Expose internal functions if needed via ref, but for now parent drives save via prop or own logic?
          // Actually, for the Overlay, the Save button is external to this component.
          // We need a way to trigger save. `triggerSave` prop added.
        />
      </Box>
    );
  },
);

RecordMdEditor.displayName = 'RecordMdEditor';
