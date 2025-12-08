import { JsonInput } from '@mantine/core';
import { FC, useCallback, useState } from 'react';

interface JsonFieldInputProps {
  columnId: string;
  initialValue: string;
  readOnly: boolean;
  updateField: (columnId: string, value: string) => void;
}

/** Helper component for JSON field with validation - prevents invalid JSON from triggering updates */
export const JsonFieldInput: FC<JsonFieldInputProps> = ({ columnId, initialValue, readOnly, updateField }) => {
  const [localValue, setLocalValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback(
    (value: string) => {
      setLocalValue(value);

      // Validate JSON
      if (!value.trim()) {
        setError(null);
        updateField(columnId, value);
        return;
      }

      try {
        JSON.parse(value);
        setError(null);
        // Only send update if JSON is valid
        updateField(columnId, value);
      } catch {
        // Don't update server with invalid JSON
        setError('Invalid JSON');
      }
    },
    [columnId, updateField],
  );

  return (
    <JsonInput
      key={columnId}
      value={localValue}
      onChange={handleChange}
      readOnly={readOnly}
      autosize
      minRows={3}
      // formatOnBlur
      error={error}
      styles={{
        input: {
          borderColor: 'transparent',
          fontSize: '13px',
          fontFamily: 'monospace',
        },
      }}
    />
  );
};
