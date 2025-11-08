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

export const TextMdHeavier = Text.withProps({
  fz: '16px',
  fw: 500,
  style: { lineHeight: '20px', letterSpacing: '0%' },
});

export const TextMdRegular = Text.withProps({
  fz: '16px',
  fw: 450,
  style: { lineHeight: '20px', letterSpacing: '0%' },
});

export const TextMdBook = Text.withProps({
  fz: '16px',
  fw: 400,
  style: { lineHeight: '20px', letterSpacing: '0%' },
});

export const TextSmHeavier = Text.withProps({
  fz: '13px',
  fw: 500,
  style: { lineHeight: '19px', letterSpacing: '0%' },
});

export const TextSmRegular = Text.withProps({
  fz: '13px',
  fw: 450,
  style: { lineHeight: '19px', letterSpacing: '0%' },
});

export const TextSmBook = Text.withProps({
  fz: '13px',
  fw: 400,
  style: { lineHeight: '19px', letterSpacing: '0%' },
});

export const TextXsHeavier = Text.withProps({
  fz: '12px',
  fw: 500,
  style: { lineHeight: '18px', letterSpacing: '0%' },
});

export const TextXsRegular = Text.withProps({
  fz: '12px',
  fw: 450,
  style: { lineHeight: '18px', letterSpacing: '0%' },
});

export const TextXsBook = Text.withProps({
  fz: '12px',
  fw: 400,
  style: { lineHeight: '18px', letterSpacing: '0%' },
});

export const TextMonoSmRegular = Text.withProps({
  ff: 'monospace',
  fz: '13px',
  fw: 400,
  style: { lineHeight: '19px', letterSpacing: '0.25px' },
});
export const TextMonoXsRegular = Text.withProps({
  ff: 'monospace',
  fz: '12px',
  fw: 400,
  style: { lineHeight: '19px', letterSpacing: '0.25px' },
});
