'use client';

import { ActionIcon, createTheme, Text, Title, virtualColor } from '@mantine/core';
import { Funnel_Display, Geist_Mono, Inter } from 'next/font/google';
import { CUSTOM_BLUE,  CUSTOM_GRAY, CUSTOM_GRAY_REVERSED, CUSTOM_GREEN, CUSTOM_RED } from './custom-colors';
import classes from './theme.module.css';
import { variantColorResolver } from './variantColorResolver';

const inter = Inter({ subsets: ['latin'] });
const funnelDisplay = Funnel_Display({ subsets: ['latin'] });
const geistMono = Geist_Mono({ subsets: ['latin'] });

export const SCRATCHPAD_MANTINE_THEME = createTheme({
  fontFamily: inter.style.fontFamily,
  fontFamilyMonospace: `${geistMono.style.fontFamily}, Courier, monospace`,

  cursorType: 'pointer',
  colors: {
    red: CUSTOM_RED,
    green: CUSTOM_GREEN,
    blue: CUSTOM_BLUE,
    gray: CUSTOM_GRAY,
    grayReversed: CUSTOM_GRAY_REVERSED,

    primary: CUSTOM_GREEN,

    /** Use this color for all dev tools */
    devTool: virtualColor({
      name: 'devTool',
      light: 'violet',
      dark: 'violet',
    }),

    // NOTE: this does not work yet, waiting to hear from Mantine team
    suggestion: virtualColor({
      name: 'suggestion',
      light: 'blue',
      dark: 'green',
    }),

    secondary: virtualColor({
      name: 'secondary',
      light: 'gray',
      dark: 'gray',
    }),

    foreground: virtualColor({
      name: 'foreground',
      light: 'gray',
      dark: 'grayReversed',
    }),
  },

  primaryColor: 'primary',
  primaryShade: { light: 8, dark: 8 }, 

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
      h1: { fontSize: '24px', lineHeight: '160%', fontWeight: '500' },
      h2: { fontSize: '18px', lineHeight: '170%', fontWeight: '500' },
      h3: { fontSize: '16px', lineHeight: '150%', fontWeight: '500' },
      h4: { fontSize: '14px', lineHeight: '160%', fontWeight: '500' },
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

    Title: Title.extend({
      defaultProps: {
        ff: funnelDisplay.style.fontFamily,
        fw: 450,
      },
    }),

    Text: Text.extend({
      // Add support for variant='dimmed'
      classNames: {root: classes.text},
    }),
  },
});
