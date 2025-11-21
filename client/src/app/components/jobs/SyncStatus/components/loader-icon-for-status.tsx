import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { RotateCwIcon } from 'lucide-react';
import { FC } from 'react';
type Props = {
  status: string;
};
export const LoaderIconForStatus: FC<Props> = (props) => {
  const { status } = props;
  if (status === 'ACTIVE') {
    return <StyledLucideIcon Icon={RotateCwIcon} />;
  }
  if (status === 'SYNCING') {
    return 'SyncLoadingSpinner';
  }

  if (status === 'INTIAILIZING') {
    return 'SyncInitializingSpinner';
  }

  return <></>;
};
