import { Text } from '@mantine/core';
import { diffWordsWithSpace } from 'diff';
import styles from './DiffViewer.module.css';

interface DiffViewerProps {
  originalValue: string;
  suggestedValue: string;
  fz?: string;
  p?: string;
}

export const DiffViewer = ({ originalValue, suggestedValue, fz = '1rem', p = '2rem' }: DiffViewerProps) => {
  // diff functions don't work with null values or undefined values
  const originalValueSafe = originalValue ?? '';
  const suggestedValueSafe = suggestedValue ?? '';

  // Run the diff and included whitespace in the changes
  const changes = diffWordsWithSpace(originalValueSafe, suggestedValueSafe);

  return (
    <Text p={p} fz={fz} className={styles.diffViewer}>
      {changes.map((change, idx) => {
        // do this to preserve newlines in the diff viewer
        const value = change.value.replaceAll('\n', '<br/>');

        if (change.added) {
          return (
            <Text span key={idx} className={styles.added} fz={fz} dangerouslySetInnerHTML={{ __html: value }}></Text>
          );
        }

        if (change.removed) {
          return (
            <Text span key={idx} className={styles.removed} fz={fz} dangerouslySetInnerHTML={{ __html: value }}></Text>
          );
        }

        return <Text span key={idx} fz="1rem" dangerouslySetInnerHTML={{ __html: value }}></Text>;
      })}
    </Text>
  );
};
