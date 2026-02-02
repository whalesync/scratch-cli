import { markdown } from '@codemirror/lang-markdown';
import { MergeView } from '@codemirror/merge';
import { Extension } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { useMantineColorScheme } from '@mantine/core';
// import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import { useEffect, useRef } from 'react';

interface MergeEditorProps {
  original: string;
  modified: string;
  onModifiedChange?: (value: string) => void;
  extensions?: Extension[];
}

export function MergeEditor({ original, modified, onModifiedChange, extensions = [] }: MergeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MergeView | null>(null);
  const { colorScheme } = useMantineColorScheme();

  // Initialize MergeView
  useEffect(() => {
    if (!containerRef.current) return;

    // const themeExtension = colorScheme === 'dark' ? githubDark : githubLight;

    const view = new MergeView({
      a: {
        doc: original,
        extensions: [markdown(), EditorView.editable.of(false), EditorView.lineWrapping, lineNumbers(), ...extensions],
      },
      b: {
        doc: modified,
        extensions: [
          markdown(),
          EditorView.lineWrapping,
          lineNumbers(),
          // themeExtension,
          EditorView.updateListener.of((update) => {
            if (update.docChanged && onModifiedChange) {
              onModifiedChange(update.state.doc.toString());
            }
          }),
          ...extensions,
        ],
      },
      parent: containerRef.current,
      collapseUnchanged: { margin: 3, minSize: 4 },
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Sync original content
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentOriginal = view.a.state.doc.toString();
    if (currentOriginal !== original) {
      view.a.dispatch({
        changes: { from: 0, to: currentOriginal.length, insert: original },
      });
    }
  }, [original]);

  // Sync modified content (only if external change)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentModified = view.b.state.doc.toString();
    if (currentModified !== modified) {
      // Avoid circular updates if possible, but basic equality check helps
      view.b.dispatch({
        changes: { from: 0, to: currentModified.length, insert: modified },
      });
    }
  }, [modified]);

  // Sync theme
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    // const themeExtension = colorScheme === 'dark' ? githubDark : githubLight;

    // We can't easily reconfigure the root theme of the merge view strictly via standard dispatch
    // without reconfiguration effects, but we can try dispatching effects to both editors if we structured it that way.
    // However, recreating on theme change is often safer/easier for complex setups unless we use a compartmentalized theme.
    // For now, let's just let it be or force re-mount if needed.
    // Actually, let's try to simple Compartment approach if we want to be fancy,
    // but simply re-mounting on theme change via key in parent is easier.
  }, [colorScheme]);

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        overflow: 'hidden',
        fontSize: '14px',
        // Force specific styling for the merge container to fit our layout
        display: 'flex',
        flexDirection: 'column',
      }}
    />
  );
}
