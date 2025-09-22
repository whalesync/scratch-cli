import { createTheme, CSSVariablesResolver, MantineColorsTuple, MantineTheme } from '@mantine/core';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

const myColor: MantineColorsTuple = [
  '#ffedfd',
  '#f7d9f2',
  '#eab1e1',
  '#dd86d0',
  '#d262c1',
  '#cc4cb9',
  '#c93fb5',
  '#b2319f',
  '#9f298e',
  '#8c1e7d',
];


export const SCRATCHPAD_MANTINE_THEME = createTheme({
  fontFamily: inter.style.fontFamily,

  cursorType: 'pointer',
  colors: { purple: myColor },

  primaryColor: 'purple',
  primaryShade: 5,

  fontSizes: {
    xs: '13px',
    sm: '14px',
    md: '16px',
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
});

// Extra variables we want exposed in CSS.
export const MANTINE_THEME_CSS_VARIABLE_RESOLVER: CSSVariablesResolver = (theme: MantineTheme) => ({
  variables: {
    '--mantine-font-weight-light': theme.other.fontWeightLight,
    '--mantine-font-weight-medium': theme.other.fontWeightMedium,
    '--mantine-font-weight-semiBold': theme.other.fontWeightSemiBold,
    '--mantine-font-weight-bold': theme.other.fontWeightBold,
  },
  light: {},
  dark: {},
});
