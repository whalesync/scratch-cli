import { Box, Group, Stack } from '@mantine/core';
import { FC, JSX } from 'react';
import classes from './SyncStatusLayout.module.css';

type Props = {
  leftIcon: JSX.Element;
  leftFlowLine: JSX.Element;
  centerIcon: JSX.Element;
  rightFlowLine: JSX.Element;
  rightIcon: JSX.Element;
  bottomLeftSlot: JSX.Element;
  bottomCenterSlot: JSX.Element;
  bottomRightSlot: JSX.Element;
};
export const SyncStatusLayout: FC<Props> = (props) => {
  const {
    leftIcon,
    leftFlowLine,
    centerIcon,
    rightFlowLine,
    rightIcon,
    bottomLeftSlot,
    bottomCenterSlot,
    bottomRightSlot,
  } = props;
  return (
    <Stack gap={1} className={classes.syncStatusLayout}>
      <Box style={{ position: 'relative' }}>
        <Group gap={0}>
          <Box className={classes.gapBox}>{/* left Gap */}</Box>
          <Box className={classes.iconBox}>{leftIcon}</Box>
          <Box className={classes.flowLineBox}>{leftFlowLine}</Box>
          {/* Center badge is removed from flow and positioned absolutely */}
          <Box className={classes.flowLineBox}>{rightFlowLine}</Box>
          <Box className={classes.iconBox}>{rightIcon}</Box>
          <Box className={classes.gapBox}>{/* right gap */}</Box>
        </Group>
        <Box className={classes.overlayBadge}>{centerIcon}</Box>
      </Box>

      <Group gap={0} style={{ alignItems: 'flex-start' }}>
        <Box className={classes.bottomBox}>{bottomLeftSlot}</Box>
        <Box className={classes.bottomBox}>{bottomCenterSlot}</Box>
        <Box className={classes.bottomBox}>{bottomRightSlot}</Box>
      </Group>
    </Stack>
  );
};
