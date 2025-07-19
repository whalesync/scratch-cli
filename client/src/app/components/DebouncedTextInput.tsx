import { TextInput, TextInputProps } from '@mantine/core';
import { ChangeEvent, useEffect, useState } from 'react';

interface DebouncedTextInputProps extends TextInputProps {
  debounceMs?: number;
}

export const DebouncedTextInput = ({ debounceMs = 300, ...props }: DebouncedTextInputProps) => {
  const [value, setValue] = useState(props.value);

  useEffect(() => {
    // WARNING: on a rerender if the props.value changes the last debounce timeout set will
    // still run and trigger an event.

    const timeout = setTimeout(() => {
      if (value !== props.value) {
        props.onChange?.({ target: { value: value as string } } as ChangeEvent<HTMLInputElement>);
      }
    }, debounceMs);

    return () => clearTimeout(timeout);
  }, [value, debounceMs, props, props.onChange]);

  return <TextInput {...props} value={value} onChange={(e) => setValue(e.target.value)} />;
};
