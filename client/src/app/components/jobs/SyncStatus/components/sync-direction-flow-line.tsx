import { Badge } from '@/app/components/base/badge';
import { Group } from '@mantine/core';
import cx from 'classnames';
import { JSX } from 'react';
import styles from '../SyncStatus.module.css';
export const SyncDirectedFlowLine = ({
  jobs,
  direction,
  hideCounts,
  moving,
}: {
  jobs?: number;
  hideCounts?: boolean;
  direction?: 'left' | 'right';
  moving?: boolean;
}): JSX.Element => {
  const hasJobs = jobs && jobs > 0;
  //   const theme = useMantineTheme();

  return (
    <Group className={styles.dashedLineContainer} gap="0px" display="flex">
      <div
        className={cx({
          [styles.dashedLine]: true,
          [styles.dashedLineActiveLeft]: moving && direction === 'left',
          [styles.dashedLineActiveRight]: moving && direction === 'right',
        })}
      />

      {hasJobs ? (
        <>
          <Badge mx="4px">
            {direction === 'left' && '←'} {hideCounts ? '' : jobs.toLocaleString()} {direction === 'right' && '→'}
          </Badge>
          <div
            className={cx({
              [styles.dashedLine]: true,
              [styles.dashedLineActiveLeft]: moving && direction === 'left',
              [styles.dashedLineActiveRight]: moving && direction === 'right',
            })}
          />
        </>
      ) : null}
    </Group>
  );
};
