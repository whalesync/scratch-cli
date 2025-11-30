import { Box, Group } from '@mantine/core';
import { FC } from 'react';
import { ExistingChangeTypes, getChangeTypeColors } from '../ProcessedFieldValue';
import styles from './DotGroup.module.css';
type Props = {
  changeTypes: ExistingChangeTypes;
};
export const DotGroup: FC<Props> = (props) => {
  const changeColors = getChangeTypeColors(props.changeTypes);
  return (
    <Group gap={1} className={styles.dotGroup}>
      <Box
        className={`${styles.cellComponentAnyDot} ${styles.cellComponentLeftDot}`}
        style={{
          backgroundColor: changeColors.deletionColor,
          boxShadow: changeColors.deletionShadow,
        }}
      ></Box>
      <Box
        className={`${styles.cellComponentAnyDot} ${styles.cellComponentRightDot}`}
        style={{
          backgroundColor: changeColors.additionColor,
          boxShadow: changeColors.additionShadow,
        }}
      ></Box>
    </Group>
  );
};
