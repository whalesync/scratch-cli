'use client';

import { ActionIcon, createTheme, Menu, Table, Title, Tooltip, virtualColor } from '@mantine/core';
import { Funnel_Display, Geist_Mono, Inter } from 'next/font/google';
import {
  CUSTOM_BLUE,
  CUSTOM_DARK,
  CUSTOM_GRAY_DARK,
  CUSTOM_GRAY_LIGHT,
  CUSTOM_GREEN_DARK,
  CUSTOM_GREEN_LIGHT,
  CUSTOM_RED_DARK,
  CUSTOM_RED_LIGHT,
} from './custom-colors';
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
    grayLight: CUSTOM_GRAY_LIGHT,
    grayDark: CUSTOM_GRAY_DARK,
    gray: virtualColor({
      name: 'gray',
      light: 'grayLight',
      dark: 'grayDark',
    }),

    redLight: CUSTOM_RED_LIGHT,
    redDark: CUSTOM_RED_DARK,
    red: virtualColor({
      name: 'red',
      light: 'redLight',
      dark: 'redDark',
    }),

    greenLight: CUSTOM_GREEN_LIGHT,
    greenDark: CUSTOM_GREEN_DARK,
    green: virtualColor({
      name: 'green',
      light: 'greenLight',
      dark: 'greenDark',
    }),

    blue: CUSTOM_BLUE,
    dark: CUSTOM_DARK,

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
  },

  primaryColor: 'greenLight',
  primaryShade: { light: 8, dark: 8 },

  // These only apply to light mode, the darkmode equivalents are set in `colors.dark` instead.
  white: '#ffffff', // colors.dark[7] in dark mode
  black: '#000000' /* Figma gray/12*. colrs.dark[0] in dark mode */,

  // variable
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
      defaultProps: {
        variant: 'subtle',
        size: 'md',
        color: 'var(--fg-muted)',
      },
    }),

    Menu: Menu.extend({
      defaultProps: {
        shadow: 'md',
        width: 200,
      },
    }),

    Table: Table.extend({
      classNames: { table: classes.table, thead: classes.tableThead, th: classes.tableTh, tbody: classes.tableTbody },
    }),

    Tooltip: Tooltip.extend({
      defaultProps: {
        // BG and FG are reversed here because the tooltip is a popup.
        color: 'var(--fg-primary)', // background.
        c: 'var(--bg-panel)', // foreground.
      },
    }),

    Title: Title.extend({
      defaultProps: {
        ff: funnelDisplay.style.fontFamily,
        fw: 450,
      },
    }),
  },
});
