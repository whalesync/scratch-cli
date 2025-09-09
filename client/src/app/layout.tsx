import '@mantine/notifications/styles.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: `${PROJECT_NAME} - AI Data Studio`,
  description: 'A data studio tool powered by Whalesync.ai',
};

import { PROJECT_NAME } from '@/constants';
import { ClerkAuthContextProvider } from '@/contexts/auth';
import { ClerkProvider } from '@clerk/nextjs';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import SidebarAndContentLayout from './components/layouts/SidebarAndContentLayout';
import { SCRATCHPAD_MANTINE_THEME } from './components/theme/theme';
import { ScratchpadPostHogProvider } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <MantineProvider theme={SCRATCHPAD_MANTINE_THEME}>
          <Notifications />
          <ClerkProvider>
            <ClerkAuthContextProvider>
              <ScratchpadPostHogProvider>
                <SidebarAndContentLayout>{children}</SidebarAndContentLayout>
              </ScratchpadPostHogProvider>
              <div id="portal" />
            </ClerkAuthContextProvider>
          </ClerkProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
