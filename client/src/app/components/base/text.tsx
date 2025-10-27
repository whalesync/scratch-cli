import { Text, Title } from '@mantine/core';

/**
 * This file contains extensions of the Mantine Text component with preset props and styles that match the design system.
 *
 * When adding new text components, please follow the naming convention of Text<Usage><Size> (e.g. TextTitleSm)
 */

export const TextTitle1 = Title.withProps({
  order: 1,
  style: { letterSpacing: '-0.5%', lineHeight: '160%' },
});

export const TextTitle2 = Title.withProps({
  order: 2,
  style: { letterSpacing: '-2%', lineHeight: '27px' },
});

export const TextTitle3 = Title.withProps({
  order: 3,
  style: { letterSpacing: '-0.08px', lineHeight: '23px' },
});

export const TextTitle4 = Title.withProps({
  order: 4,
  style: { letterSpacing: '-0.07px', lineHeight: '22px' },
});

// Heavier weight (aka "Medium" which is confusing with "Medium" size) = 500.

export const TextHeavierMd = Text.withProps({
  fz: '14px',
  fw: 500,
  style: { lineHeight: '20px', letterSpacing: '0%' },
});

export const TextHeavierSm = Text.withProps({
  fz: '13px',
  fw: 500,
  style: { lineHeight: '19px', letterSpacing: '0%' },
});

export const TextHeavierXs = Text.withProps({
  fz: '12px',
  fw: 500,
  style: { lineHeight: '18px', letterSpacing: '0%' },
});

// Regular = 450

export const TextRegularMd = Text.withProps({
  fz: '14px',
  fw: 450,
  style: { lineHeight: '20px', letterSpacing: '0%' },
});

export const TextRegularSm = Text.withProps({
  fz: '13px',
  fw: 450,
  style: { lineHeight: '19px', letterSpacing: '0%' },
});

export const TextRegularXs = Text.withProps({
  fz: '12px',
  fw: 450,
  style: { lineHeight: '18px', letterSpacing: '0%' },
});

// Book = 400

export const TextBookMd = Text.withProps({
  fz: '14px',
  fw: 400,
  style: { lineHeight: '20px', letterSpacing: '0%' },
});

export const TextBookSm = Text.withProps({
  fz: '13px',
  fw: 400,
  style: { lineHeight: '19px', letterSpacing: '0%' },
});

export const TextBookSmLight = Text.withProps({
  fz: '13px',
  fw: 400,
  style: { lineHeight: '19px', letterSpacing: '0%' },
  c: 'gray.8',
});

export const TextBookXs = Text.withProps({
  fz: '12px',
  fw: 400,
  style: { lineHeight: '18px', letterSpacing: '0%' },
});

// TODO: Also add fixed-width.
