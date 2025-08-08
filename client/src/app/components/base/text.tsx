import { Text } from '@mantine/core';

/**
 * This file contains extensions of the Mantine Text component with preset props and styles that match the design system.
 *
 * When adding new text components, please follow the naming convention of Text<Usage><Size> (e.g. TextTitleSm)
 */

export const TextTitleXs = Text.withProps({
  fz: '14px',
  fw: 500,
  c: 'gray.11',
  style: { letterSpacing: '-0.07px', lineHeight: '22px' },
});

export const TextTitleSm = Text.withProps({
  fz: '15px',
  fw: 500,
  c: 'gray.11',
  style: { letterSpacing: '-0.08px', lineHeight: '23px' },
});

export const TextTitleLg = Text.withProps({
  fz: 'lg',
  fw: 500,
  c: 'gray.11',
  style: { letterSpacing: '-2%', lineHeight: '27px' },
});

export const TextTitle2XL = Text.withProps({
  fz: '24px',
  fw: '500',
  c: 'gray.11',
  style: { letterSpacing: '-0.5%', lineHeight: '160%' },
});

export const TextRegularSm = Text.withProps({
  fz: '14px',
  fw: 450,
  style: { lineHeight: '22px', letterSpacing: '0%' },
});

export const TextRegularXs = Text.withProps({
  fz: '13px',
  fw: 450,
  style: { lineHeight: '21px', letterSpacing: '0%' },
});

export const TextBookSm = Text.withProps({
  fw: 400,
  fz: '14px',
  style: { lineHeight: '22px', letterSpacing: '0%' },
});

export const TextBookXs = Text.withProps({
  fw: 400,
  fz: '13px',
  style: { lineHeight: '21px', letterSpacing: '0%' },
});
