import { Button } from '@mantine/core';
import { Cpu } from 'lucide-react';
import { StyledLucideIcon } from '../Icons/StyledLucideIcon';
import customBordersClasses from '../theme/custom-borders.module.css';

export const ButtonPrimarySolid = Button.withProps({
  variant: 'filled',
  size: 'sm',
  color: 'primary.7', // fill
  c: 'background', // text
  styles: { root: { border: 'primary.9', backgroundColor: 'primary.7' } },
});

export const ButtonPrimaryLight = Button.withProps({
  variant: 'light',
  size: 'sm',
  color: 'primary.8', // fill
  c: 'primary.8', // text
  classNames: { root: customBordersClasses.cornerBorders },
});

export const ButtonSecondarySolid = Button.withProps({
  variant: 'filled',
  size: 'sm',
  color: 'surface.9', // fill
  c: 'background', // text
});

export const ButtonSecondaryOutline = Button.withProps({
  variant: 'outline',
  size: 'sm',
  color: 'surface.9',
  c: 'surface.9', // text
  classNames: { root: customBordersClasses.cornerBorders },
});

export const ButtonSecondaryGhost = Button.withProps({
  variant: 'subtle',
  size: 'sm',
  color: 'surface.9',
  c: 'surface.9',
});

export const ButtonSecondaryInline = Button.withProps({
  w: 'min-content',
  size: 'compact-sm',
  variant: 'subtle',
  color: 'surface.9',
  c: 'surface.9',
});

export const ButtonDangerLight = Button.withProps({
  variant: 'light',
  size: 'sm',
  color: 'red.9',
  c: 'red.9',
  classNames: { root: customBordersClasses.cornerBorders },
});

export const DevToolButton = Button.withProps({
  variant: 'outline',
  c: 'devTool',
  color: 'devTool',
  leftSection: <StyledLucideIcon Icon={Cpu} />,
  classNames: { root: customBordersClasses.cornerBorders },
});

/** @deprecated */
export const AcceptSuggestionButton = Button.withProps({
  size: 'xs',
  variant: 'outline',
  color: 'primary', // border
  c: 'primary', // text
});

/** @deprecated */
export const RejectSuggestionButton = Button.withProps({
  size: 'xs',
  variant: 'outline',
  color: 'surface',
  c: 'surface',
});

/** @deprecated */
export const ContentFooterButton = Button.withProps({
  variant: 'subtle',
  size: 'xs',
  c: 'gray',
});
