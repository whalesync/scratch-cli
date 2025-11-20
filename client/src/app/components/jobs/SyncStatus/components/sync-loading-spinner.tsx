import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import styles from '@/components/v2/common/SyncStatus/SyncStatus.module.css';
import { useMantineTheme } from '@mantine/core';
import { ArrowsClockwiseIcon } from '@phosphor-icons/react';
import { JSX } from 'react';
export const SyncLoadingSpinner = (): JSX.Element => {
  const theme = useMantineTheme();
  return (
    <StyledLucideIcon Icon={ArrowsClockwiseIcon} className={styles.baseLoadingIndicator} c={theme.colors.gray[8]} />
  );
};
