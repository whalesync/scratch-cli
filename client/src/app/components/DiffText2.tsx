import { Box, Text } from '@mantine/core';
import { diffWordsWithSpace } from 'diff';
import { FC } from 'react';

interface DiffTextProps {
  originalValue: string;
  suggestedValue: string;
  fz?: string;
  p?: string;
  splitMinRows?: number;
}

/**
 * This is a fork of DiffViewer to be used as the content of the grid cell.
 * We should probably merge the 2, but for the initial release it is quicker to keep them separate.
 */
export const DiffText2: FC<DiffTextProps> = ({ originalValue, suggestedValue }: DiffTextProps) => {
  // diff functions don't work with null values or undefined values
  const originalValueSafe = originalValue ?? '';
  const suggestedValueSafe = suggestedValue ?? '';

  // Run the diff and included whitespace in the changes
  const changes = diffWordsWithSpace(originalValueSafe, suggestedValueSafe);

  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'clip',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        gap: '5px', // Add spacing between diff elements
      }}
    >
      {changes.map((change, idx) => {
        // do this to preserve newlines in the diff viewer
        const value = change.value.replaceAll('\n', '<br/>');

        if (change.added) {
          return (
            <Text
              span
              key={idx}
              c="green"
              bg="green.1"
              className="cell-text"
              dangerouslySetInnerHTML={{ __html: value }}
            ></Text>
          );
        }

        if (change.removed) {
          return (
            <Text
              span
              key={idx}
              c="red"
              bg="red.1"
              className="cell-text"
              dangerouslySetInnerHTML={{ __html: value }}
              style={{
                // ba
                textDecoration: 'line-through',
              }}
            ></Text>
          );
        }

        return <Text span key={idx} className="cell-text" dangerouslySetInnerHTML={{ __html: value }}></Text>;
      })}
    </Box>
  );
};
