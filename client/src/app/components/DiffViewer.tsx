import { Text } from '@mantine/core';
import { diffWordsWithSpace } from 'diff';

export const DiffViewer = ({ originalValue, suggestedValue }: { originalValue: string; suggestedValue: string }) => {
  // diff functions don't work with null values or undefined values
  const originalValueSafe = originalValue ?? '';
  const suggestedValueSafe = suggestedValue ?? '';

  // Run the diff and included whitespace in the changes
  const changes = diffWordsWithSpace(originalValueSafe, suggestedValueSafe);

  return (
    <Text size="xs" p="2rem" fz="1rem" style={{ border: 'none' }}>
      {changes.map((change, idx) => {
        // do this to preserve newlines in the diff viewer
        const value = change.value.replaceAll('\n', '<br/>');

        if (change.added) {
          return <Text span key={idx} c="green" fz="1rem" dangerouslySetInnerHTML={{ __html: value }}></Text>;
        }

        if (change.removed) {
          return (
            <Text
              span
              key={idx}
              c="red"
              fz="1rem"
              style={{ textDecoration: 'line-through' }}
              dangerouslySetInnerHTML={{ __html: value }}
            ></Text>
          );
        }

        return <Text span key={idx} fz="1rem" dangerouslySetInnerHTML={{ __html: value }}></Text>;
      })}
    </Text>
  );
};
