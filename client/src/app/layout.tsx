import '@mantine/notifications/styles.css';
import { GoogleAnalytics } from '@next/third-parties/google';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../ag-grid-css';
// import '../ag-grid-css/ag-grid-global.css';
// import '../ag-grid-css/ag-grid-variables.css';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: `${PROJECT_NAME} - AI Data Studio`,
  description: 'A data studio tool powered by Whalesync.ai',
};

import { PROJECT_NAME } from '@/constants';
import { ClerkAuthContextProvider } from '@/contexts/auth';
import { ClerkProvider } from '@clerk/nextjs';
import { ColorSchemeScript, mantineHtmlProps, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { SCRATCHPAD_MANTINE_THEME } from './components/theme/theme';
import { ScratchpadPostHogProvider } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        {process.env.NEXT_PUBLIC_GA_ID && <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID as string} />}
        <ColorSchemeScript />
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width, user-scalable=no" />
      </head>

      <body className={inter.className}>
        <MantineProvider theme={SCRATCHPAD_MANTINE_THEME} defaultColorScheme="light">
          <Notifications />
          <ClerkProvider>
            <ClerkAuthContextProvider>
              <ScratchpadPostHogProvider>{children}</ScratchpadPostHogProvider>
              <div id="portal" />
            </ClerkAuthContextProvider>
          </ClerkProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
