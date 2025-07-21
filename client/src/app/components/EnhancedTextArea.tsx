import { Textarea, TextareaProps } from '@mantine/core';
import { forwardRef, useImperativeHandle, useRef } from 'react';

interface EnhancedTextAreaProps extends TextareaProps {
  onSelectionChange?: (selection: { start: number; end: number; text: string }) => void;
  onCursorChange?: (cursor: { start: number; end: number }) => void;
}

export interface TextAreaRef {
  getCursorPosition: () => { start: number; end: number };
  getSelectedText: () => string;
  setCursorPosition: (start: number, end?: number) => void;
  focus: () => void;
}

export const EnhancedTextArea = forwardRef<TextAreaRef, EnhancedTextAreaProps>(
  ({ onSelectionChange, ...props }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      getCursorPosition: () => {
        const textarea = textareaRef.current;
        if (!textarea) return { start: 0, end: 0 };
        return {
          start: textarea.selectionStart,
          end: textarea.selectionEnd,
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

    const handleSelectionChange = () => {
      const textarea = textareaRef.current;
      if (!textarea || !onSelectionChange) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value.substring(start, end);
      console.debug('EnhancedTextArea selection change:', { start, end, text });
      onSelectionChange({ start, end, text });
    };

    return (
      <Textarea
        {...props}
        ref={textareaRef}
        value={props.value}
        onSelect={handleSelectionChange}
        onMouseUp={handleSelectionChange}
        onKeyUp={handleSelectionChange}
        onMouseDown={handleSelectionChange}
        onKeyDown={handleSelectionChange}
        onInput={handleSelectionChange}
      />
    );
  },
);

EnhancedTextArea.displayName = 'EnhancedTextArea';
