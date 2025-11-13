import { Center } from '@mantine/core';
import { LucideIcon } from 'lucide-react';
import customBordersClasses from '../theme/custom-borders.module.css';
import { StyledLucideIcon } from './StyledLucideIcon';

/** Sometimes you want your icon in a little box when it's just there for decoration. */
export const DecorativeBoxedIcon = ({
  Icon,
  c = 'var(--fg-muted)',
  bg,
}: {
  Icon: LucideIcon;
  c?: string;
  bg?: string;
}) => {
  return (
    <Center c={c} bg={bg} w={28} h={28} className={customBordersClasses.cornerBorders}>
      <StyledLucideIcon Icon={Icon} size={16} />
    </Center>
  );
};
