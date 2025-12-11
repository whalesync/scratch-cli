import { html } from '@codemirror/lang-html';
import { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import { useMemo } from 'react';

interface HtmlViewerProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  minHeight?: string;
}

export const HtmlViewer: React.FC<HtmlViewerProps> = ({ value, onChange, readOnly = false, minHeight = '100px' }) => {
  const extensions = useMemo(() => {
    const exts: Extension[] = [html(), EditorView.lineWrapping];
    if (readOnly) {
      exts.push(EditorView.editable.of(false));
    }
    return exts;
  }, [readOnly]);

  const theme = useMemo(
    () =>
      EditorView.theme({
        '&': {
          backgroundColor: 'var(--bg-panel)',
          color: 'var(--fg-primary)',
          fontSize: '13px',
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
          minHeight: minHeight,
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
          display: 'none', // Hide line numbers
        },
      }),
    [minHeight],
  );

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme={theme}
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLineGutter: false,
        syntaxHighlighting: true,
        bracketMatching: true,
        closeBrackets: !readOnly,
        autocompletion: !readOnly,
        highlightActiveLine: !readOnly,
        drawSelection: false,
      }}
      editable={!readOnly}
      style={{
        border: '1px solid var(--mantine-color-gray-3)',
        borderRadius: '4px',
        width: '100%',
      }}
    />
  );
};
