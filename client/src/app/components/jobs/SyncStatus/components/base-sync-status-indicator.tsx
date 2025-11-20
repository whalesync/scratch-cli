import styles from '@/components/v2/common/SyncStatus/SyncStatus.module.css';
import { Box } from '@mantine/core';
import cx from 'classnames';
import { FC, JSX } from 'react';

export const BaseSyncStatusIndicator = ({ status }: { status: string | null }): JSX.Element => {
  return (
    <Box
      className={cx({
        [styles.baseActiveStatusIndicator]: status !== 'INACTIVE',
        [styles.baseStatusIndicator]: true,
      })}
    />
  );
};

type Props = {
  color?: string;
};
export const BaseSyncStatusIndicatorNew: FC<Props> = (props) => {
  const { color } = props;
  return <Box className={styles.baseStatusIndicator} bg={color} />;
};
