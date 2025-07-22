import { Group, Text, Textarea, TextareaProps } from '@mantine/core';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';

export type TextSelection = {
  start: number;
  end: number;
  text: string;
};

export type CursorPosition = {
  position: number;
};

interface EnhancedTextAreaProps extends TextareaProps {
  onSelectionChange?: (selection: { start: number; end: number; text: string }) => void;
  onCursorChange?: (cursor: CursorPosition) => void;
}

export interface TextAreaRef {
  getCursorPosition: () => CursorPosition;
  getSelectedText: () => string;
  setCursorPosition: (start: number, end?: number) => void;
  focus: () => void;
}

export const EnhancedTextArea = forwardRef<TextAreaRef, EnhancedTextAreaProps>(
  ({ onSelectionChange, onCursorChange, ...props }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [currentSelection, setCurrentSelection] = useState<TextSelection | undefined>(undefined);
    const [currentCursorPosition, setCurrentCursorPosition] = useState<CursorPosition | undefined>(undefined);

    useImperativeHandle(ref, () => ({
      getCursorPosition: () => {
        const textarea = textareaRef.current;
        if (!textarea) return { position: 0 };
        return {
          position: textarea.selectionStart,
        };
      },
      getSelectedText: () => {
        const textarea = textareaRef.current;
        if (!textarea) return '';
        return textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
      },
      setCursorPosition: (start: number, end?: number) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.setSelectionRange(start, end ?? start);
        textarea.focus();
      },
      focus: () => {
        textareaRef.current?.focus();
      },
    }));

    const handleSelectionChange = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value.substring(start, end);

      setCurrentSelection({ start, end, text });
      setCurrentCursorPosition({ position: start });
      onSelectionChange?.({ start, end, text });
      onCursorChange?.({ position: start });
    }, [textareaRef, onSelectionChange, onCursorChange]);

    const label = (
      <Group gap="xs" wrap="nowrap">
        <Text span fw="500">
          {props.label}
        </Text>
        {currentSelection && currentSelection?.text.length > 0 ? (
          <Text fz="xs" c="dimmed">
            {currentSelection.text.length} chars selected
          </Text>
        ) : null}
        {currentCursorPosition && (
          <Text fz="xs" c="dimmed">
            Cursor: {currentCursorPosition.position}
          </Text>
        )}
      </Group>
    );

    return (
      <>
        <Textarea
          {...props}
          label={label}
          ref={textareaRef}
          value={props.value}
          onSelect={handleSelectionChange}
          onMouseUp={handleSelectionChange}
          onKeyUp={handleSelectionChange}
          onClick={handleSelectionChange}
        />
      </>
    );
  },
);

EnhancedTextArea.displayName = 'EnhancedTextArea';
