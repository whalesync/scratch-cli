import { Box, Group, Textarea } from '@mantine/core';
import { useToggle } from '@mantine/hooks';
import { ArrowsMergeIcon, SquareSplitHorizontalIcon } from '@phosphor-icons/react';
import { FC } from 'react';
import { DiffText } from './DiffText';
import { ToolIconButton } from './ToolIconButton';

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
      <ToolIconButton
        icon={mode === 'split' ? ArrowsMergeIcon : SquareSplitHorizontalIcon}
        onClick={() => toggleMode()}
        tooltip={mode === 'split' ? 'Show Diff' : 'Show Split'}
        size="lg"
      />
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
              borderColor: 'light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-6))',
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
              borderColor: 'light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-6))',
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
      {switchButton}
    </Group>
  );
};
