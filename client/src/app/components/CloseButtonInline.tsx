import { ButtonProps } from '@mantine/core';
import { X } from 'lucide-react';
import { DOMAttributes } from 'react';
import { IconButtonInline } from './base/buttons';
import { StyledLucideIcon } from './Icons/StyledLucideIcon';

export const CloseButtonInline = (props: ButtonProps & DOMAttributes<HTMLButtonElement>) => {
  return (
    <IconButtonInline size="compact-xs" {...props}>
      <StyledLucideIcon Icon={X} size="sm" />
    </IconButtonInline>
  );
};
