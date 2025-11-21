import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import styles from '@/components/v2/common/SyncStatus/SyncStatus.module.css';
import { useMantineTheme } from '@mantine/core';
import { RotateCwIcon } from 'lucide-react';
import { JSX } from 'react';
export const SyncInitializingSpinner = (): JSX.Element => {
  const theme = useMantineTheme();
  return <StyledLucideIcon Icon={RotateCwIcon} className={styles.baseLoadingIndicator} c={theme.colors.gray[8]} />;
};
