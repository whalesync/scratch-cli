import { Button } from '@mantine/core';
import { Cpu } from 'lucide-react';
import { StyledLucideIcon } from '../Icons/StyledLucideIcon';
import customBordersClasses from '../theme/custom-borders.module.css';

export const ButtonPrimarySolid = Button.withProps({
  variant: 'filled',
  size: 'sm',
  color: 'var(--mantine-color-green-6)', // fill
  c: 'var(--mantine-color-green-0)', // text
  styles: { root: { borderColor: 'var(--mantine-color-green-8)' } },
});

export const ButtonPrimaryLight = Button.withProps({
  variant: 'light',
  size: 'sm',
  c: 'green.8', // text
  classNames: { root: customBordersClasses.cornerBorders },
  styles: { root: { backgroundColor: 'var(--mantine-color-green-2)' } },
});

export const ButtonSecondarySolid = Button.withProps({
  variant: 'filled',
  size: 'sm',
  color: 'gray.9', // fill
  c: 'background', // text
});

export const ButtonSecondaryOutline = Button.withProps({
  variant: 'outline',
  size: 'sm',
  color: 'var(--fg-muted)',
  c: 'var(--fg-muted)', // text
  bg: 'var(--bg-base)',
  classNames: { root: customBordersClasses.cornerBorders },
  styles: {
    section: { color: 'var(--fg-muted)' },
    inner: { color: 'var(--fg-primary)' },
  },
});

export const ButtonSecondaryGhost = Button.withProps({
  variant: 'subtle',
  size: 'sm',
  color: 'gray.9',
  c: 'gray.9',
});

export const ButtonSecondaryInline = Button.withProps({
  w: 'min-content',
  size: 'compact-sm',
  variant: 'subtle',
  color: 'var(--fg-primary)',
  c: 'var(--fg-primary)',
  styles: {
    section: { color: 'var(--fg-muted)' },
  },
});

export const ButtonDangerLight = Button.withProps({
  variant: 'light',
  size: 'sm',
  color: 'red.6',
  c: 'red.8',
  classNames: { root: customBordersClasses.cornerBorders },
});

export const IconButtonOutline = Button.withProps({
  variant: 'outline',
  size: 'sm',
  color: 'gray.9',
  c: 'gray.6',
  p: 0,
  classNames: { root: customBordersClasses.cornerBorders },
  styles: {
    root: { aspectRatio: '1' },
    inner: { color: 'var(--mantine-color-gray-9)' },
  },
});

export const IconButtonGhost = Button.withProps({
  variant: 'subtle',
  size: 'sm',
  color: 'var(--fg-muted)',
  c: 'var(--fg-muted)',
  p: 0,
  styles: {
    root: { aspectRatio: '1' },
  },
});

export const IconButtonInline = Button.withProps({
  variant: 'subtle',
  w: 'min-content',
  size: 'compact-sm',
  color: 'redvar(--fg-muted)',
  c: 'var(--fg-muted)',
  p: 0,
  styles: {
    root: { aspectRatio: '1' },
  },
});

export const DevToolButton = Button.withProps({
  variant: 'outline',
  c: 'devTool',
  color: 'devTool',
  leftSection: <StyledLucideIcon Icon={Cpu} />,
  classNames: { root: customBordersClasses.cornerBorders },
});

export const DevToolButtonGhost = Button.withProps({
  variant: 'subtle',
  size: 'sm',
  c: 'devTool',
  color: 'devTool',
  leftSection: <StyledLucideIcon Icon={Cpu} />,
});

/** @deprecated */
export const AcceptSuggestionButton = Button.withProps({
  size: 'xs',
  variant: 'outline',
  color: 'green', // border
  c: 'green', // text
});

/** @deprecated */
export const RejectSuggestionButton = Button.withProps({
  size: 'xs',
  variant: 'outline',
  color: 'gray',
  c: 'gray',
});

/** @deprecated */
export const ContentFooterButton = Button.withProps({
  variant: 'subtle',
  size: 'xs',
  c: 'var(--fg-primary)',
  fz: 13,
  fw: 425,
});
