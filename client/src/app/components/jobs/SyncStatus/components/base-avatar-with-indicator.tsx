import { DecorativeBoxedIcon } from '@/app/components/Icons/DecorativeBoxedIcon';
import { Box } from '@mantine/core';
import { Table2Icon } from 'lucide-react';
import { JSX } from 'react';
import styles from '../SyncStatus.module.css';
export const TableIndicator = (): JSX.Element => {
  return (
    <Box className={styles.avatarContainer}>
      <DecorativeBoxedIcon Icon={Table2Icon} />
    </Box>
  );
};
