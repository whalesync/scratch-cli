import { Textarea, TextareaProps } from '@mantine/core';
import { ChangeEvent, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

interface DebouncedTextAreaProps extends TextareaProps {
  debounceMs?: number;
  onSelectionChange?: (selection: { start: number; end: number; text: string }) => void;
  onCursorChange?: (cursor: { start: number; end: number }) => void;
}

export interface TextAreaRef {
  getCursorPosition: () => { start: number; end: number };
  getSelectedText: () => string;
  setCursorPosition: (start: number, end?: number) => void;
  focus: () => void;
}

export const DebouncedTextArea = forwardRef<TextAreaRef, DebouncedTextAreaProps>(
  ({ debounceMs = 300, onSelectionChange, ...props }, ref) => {
    const [value, setValue] = useState(props.value);
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

      onSelectionChange({ start, end, text });
    };

    useEffect(() => {
      // WARNING: on a rerender if the props.value changes the last debounce timeout set will
      // still run and trigger an event.
      const timeout = setTimeout(() => {
        if (value !== props.value) {
          props.onChange?.({ target: { value: value as string } } as ChangeEvent<HTMLTextAreaElement>);
        }
      }, debounceMs);

      return () => clearTimeout(timeout);
    }, [value, debounceMs, props, props.onChange]);

    return (
      <Textarea
        {...props}
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onSelect={handleSelectionChange}
        onMouseUp={handleSelectionChange}
        onKeyUp={handleSelectionChange}
      />
    );
  },
);

DebouncedTextArea.displayName = 'DebouncedTextArea';
