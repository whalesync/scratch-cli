import { ActionIcon, Box, Group, Textarea, Tooltip } from '@mantine/core';
import { useToggle } from '@mantine/hooks';
import { ArrowsMergeIcon, SquareSplitHorizontalIcon } from '@phosphor-icons/react';
import { FC } from 'react';
import { DiffText } from './DiffText';

interface DiffViewerProps {
  originalValue: string;
  suggestedValue: string;
  fz?: string;
  p?: string;
  splitMinRows?: number;
}

export const DiffViewer: FC<DiffViewerProps> = (props) => {
  const { originalValue, suggestedValue, fz = '1rem', p = '2rem', splitMinRows = 5 } = props;
  const [mode, toggleMode] = useToggle(['diff', 'split']);

  // diff functions don't work with null values or undefined values
  const originalValueSafe = originalValue ?? '';
  const suggestedValueSafe = suggestedValue ?? '';

  // Run the diff and included whitespace in the changes
  // const changes = diffWordsWithSpace(originalValueSafe, suggestedValueSafe);

  const switchButton = (
    <Box style={{ position: 'absolute', top: 0, right: 0, zIndex: 10 }}>
      <Tooltip label={mode === 'split' ? 'Show Diff' : 'Show Split'}>
        <ActionIcon size="sm" onClick={() => toggleMode()} variant="subtle">
          {mode === 'split' ? <ArrowsMergeIcon size={18} /> : <SquareSplitHorizontalIcon size={18} />}
        </ActionIcon>
      </Tooltip>
    </Box>
  );

  if (mode === 'split') {
    return (
      <Group align="flex-start" gap="xs" p={p}>
        <Textarea
          label="Original"
          value={originalValueSafe}
          autosize
          minRows={splitMinRows}
          readOnly
          flex={1}
          styles={{
            input: {
              fontSize: fz,
              padding: '1rem',
              borderColor: 'var(--mantine-color-gray-2)',
              borderRadius: '0px',
            },
          }}
        />
        <Textarea
          label="Suggested"
          value={suggestedValueSafe}
          autosize
          minRows={splitMinRows}
          readOnly
          flex={1}
          styles={{
            input: {
              fontSize: fz,
              padding: '1rem',
              borderColor: 'var(--mantine-color-gray-2)',
              borderRadius: '0px',
            },
          }}
        />
        {switchButton}
      </Group>
    );
  }

  return (
    <Group p={0}>
      <DiffText {...props} />
      {/* <Text p={p} fz={fz} className={styles.diffViewer}>
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
              <Text
                span
                key={idx}
                className={styles.removed}
                fz={fz}
                dangerouslySetInnerHTML={{ __html: value }}
              ></Text>
            );
          }

          return <Text span key={idx} fz="1rem" dangerouslySetInnerHTML={{ __html: value }}></Text>;
        })}
      </Text> */}
      {switchButton}
    </Group>
  );
};
