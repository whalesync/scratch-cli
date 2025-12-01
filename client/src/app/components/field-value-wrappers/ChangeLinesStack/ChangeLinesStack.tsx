import { Box, Stack } from '@mantine/core';
import { FC } from 'react';
import { ExistingChangeTypes, getChangeTypeColors } from '../ProcessedFieldValue';
import styles from './ChangeLinesStack.module.css';

type Props = {
  changeTypes: ExistingChangeTypes;
};

/**
 * LineStack renders two vertical lines stacked vertically.
 * Styles are moved to a CSS module for cleaner markup.
 * Colors are derived from changeTypes using getChangeTypeColors.
 */
export const ChangeLinesStack: FC<Props> = ({ changeTypes }) => {
  const { additionColor, additionShadow, deletionColor, deletionShadow } = getChangeTypeColors(changeTypes);

  return (
    <Stack className={styles.container}>
      <Box className={styles.line} style={{ backgroundColor: additionColor, boxShadow: additionShadow }} />
      <Box className={styles.line} style={{ backgroundColor: deletionColor, boxShadow: deletionShadow }} />
    </Stack>
  );
};
