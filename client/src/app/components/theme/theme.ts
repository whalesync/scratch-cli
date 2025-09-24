import { createTheme, MantineColorsTuple, virtualColor } from '@mantine/core';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

const penBlue: MantineColorsTuple = [
  "#e8f3ff",
  "#d1e2fe",
  "#a0c1fa",
  "#6c9ff7",
  "#4383f5",
  "#2c70f5",
  "#1f67f6",
  "#1257db",
  "#0551cf",
  "#0042ae",
];

const terminalGreen: MantineColorsTuple = [
  '#f5ffe2',
  '#ecfdce',
  '#d9f9a0',
  '#c5f56d',
  '#b4f243',
  '#a9f027',
  '#a3ef15',
  '#8dd402',
  '#7cbd00',
  '#68a300',
];

export const SCRATCHPAD_MANTINE_THEME = createTheme({
  fontFamily: inter.style.fontFamily,

  cursorType: 'pointer',
  colors: {
    penBlue: penBlue,
    terminalGreen: terminalGreen,
    // NOTE: this does not work yet, waiting to hear from Mantine team
    primary: virtualColor({
      name: 'primary',
      light: 'penBlue',
      dark: 'terminalGreen',
    }),
  },
  primaryColor: 'penBlue',
  primaryShade: 7,

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
