import { Box, Group, Tooltip } from '@mantine/core';
import { FC } from 'react';
import { ExistingChangeTypes, getChangeTypeColors } from '../ProcessedFieldValue';
import styles from './ChangeDotsGroup.module.css';

type Props = {
  changeTypes: ExistingChangeTypes;
};
export const ChangeDotsGroup: FC<Props> = (props) => {
  const changeColors = getChangeTypeColors(props.changeTypes);
  let tooltipText = '';
  if (props.changeTypes.suggestedAdditions || props.changeTypes.suggestedDeletions) {
    tooltipText = 'Suggested changes';
  } else {
    tooltipText = 'Unpublished changes';
  }
  return (
    <Tooltip label={tooltipText} position="top" withArrow>
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
    </Tooltip>
  );
};
