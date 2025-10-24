'use client';

import { ActionIcon, Button, createTheme, Title, virtualColor } from '@mantine/core';
import { Funnel_Display, Inter } from 'next/font/google';
import cornerBordersClasses from './corner-borders.module.css';
import { CUSTOM_BLUE, CUSTOM_GRAY, CUSTOM_GREEN, CUSTOM_RED } from './custom-colors';
import classes from './theme.module.css';
import { variantColorResolver } from './variantColorResolver';

const inter = Inter({ subsets: ['latin'] });
const funnelDisplay = Funnel_Display({ subsets: ['latin'] });
// TODO: Use Berkley Mono for monospace fonts.

export const SCRATCHPAD_MANTINE_THEME = createTheme({
  fontFamily: inter.style.fontFamily,

  cursorType: 'pointer',
  colors: {
    gray: CUSTOM_GRAY,
    red: CUSTOM_RED,
    green: CUSTOM_GREEN,
    blue: CUSTOM_BLUE,

    // NOTE: this does not work yet, waiting to hear from Mantine team
    suggestion: virtualColor({
      name: 'suggestion',
      light: 'blue',
      dark: 'green',
    }),
    primary: CUSTOM_GREEN,

    secondary: virtualColor({
      name: 'secondary',
      light: 'gray',
      dark: 'gray',
    }),
  },

  primaryColor: 'primary',

  variantColorResolver: variantColorResolver,

  fontSizes: {
    xs: '12px',
    sm: '13px',
    md: '14px',
  },

  headings: {
    fontFamily: funnelDisplay.style.fontFamily,
    fontWeight: '450',
    sizes: {
      h1: { fontSize: '24px', lineHeight: '160%' },
      h2: { fontSize: '16px', lineHeight: '170%' },
      h3: { fontSize: '15px', lineHeight: '150%' },
      h4: { fontSize: '14px', lineHeight: '160%' },
    },
  },

  // TODO: In design we dont have variables for spacing,
  // so taking a base spaces and adding it here
  spacing: {
    '2xs': '4px',
    xs: '8px',
    sm: '12px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },

  radius: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '10px',
    full: '100%',
  },

  defaultRadius: '0px',

  components: {
    ActionIcon: ActionIcon.extend({
      classNames: classes,
    }),

    Button: Button.extend({
      classNames: { root: cornerBordersClasses.cornerBorders },
    }),

    Title: Title.extend({
      defaultProps: {
        ff: funnelDisplay.style.fontFamily,
        fw: 450,
      },
    }),
  },
});
