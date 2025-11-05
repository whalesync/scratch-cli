import { Tooltip } from '@mantine/core';
import { formatDate, timeAgo } from '../../utils/helpers';

export const RelativeDate = ({ date }: { date: string | Date }) => {
  return (
    <Tooltip label={formatDate(date)}>
      <span>{timeAgo(date)}</span>
    </Tooltip>
  );
};
