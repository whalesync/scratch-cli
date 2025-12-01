import { Box, Group } from '@mantine/core';
import { FC } from 'react';
import { ExistingChangeTypes, getChangeTypeColors } from '../ProcessedFieldValue';
import styles from './ChangeDotsGroup.module.css';
type Props = {
  changeTypes: ExistingChangeTypes;
};
export const ChangeDotsGroup: FC<Props> = (props) => {
  const changeColors = getChangeTypeColors(props.changeTypes);
  return (
    <Group gap={4} className={styles.dotGroup}>
      <Box
        className={styles.cellComponentAnyDot}
        style={{
          backgroundColor: changeColors.deletionColor,
          boxShadow: changeColors.deletionShadow,
        }}
      ></Box>
      <Box
        className={styles.cellComponentAnyDot}
        style={{
          backgroundColor: changeColors.additionColor,
          boxShadow: changeColors.additionShadow,
        }}
      ></Box>
    </Group>
  );
};
