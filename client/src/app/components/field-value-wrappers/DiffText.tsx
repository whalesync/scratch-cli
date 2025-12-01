import { Box, MantineStyleProps, Text } from '@mantine/core';
import { ChangeObject } from 'diff';
import { FC } from 'react';
import styles from './value/FieldValueWrapper.module.css';

type DiffTextProps = MantineStyleProps & {
  changes: ChangeObject<string>[];
};

/**
 * This is a fork of DiffViewer to be used as the content of the grid cell.
 * We should probably merge the 2, but for the initial release it is quicker to keep them separate.
 */
export const DiffText: FC<DiffTextProps> = ({ changes, ...styleProps }: DiffTextProps) => {
  return (
    <Box className={styles.diffTextContainer} {...styleProps}>
      {changes.map((change, idx) => {
        // do this to preserve newlines in the diff viewer
        const value = change.value.replaceAll('\n', '<br/>');

        if (change.added) {
          return (
            <Text
              span
              key={idx}
              c="var(--fg-added)"
              bg="var(--bg-added)"
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
              c="var(--fg-removed)"
              bg="var(--bg-removed)"
              className="cell-text"
              dangerouslySetInnerHTML={{ __html: value }}
              style={{
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
