'use client';

import { ClerkAuthContextProvider } from '@/contexts/auth';
import { ClerkProvider } from '@clerk/nextjs';
import { AppShell, MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { Notifications } from '@mantine/notifications';
import { SideMenu } from './components/SideMenu';
import { SCRATCHPAD_MANTINE_THEME } from './components/theme/theme';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={SCRATCHPAD_MANTINE_THEME}>
      <Notifications />
      <ClerkProvider>
        <ClerkAuthContextProvider>
          <AppShell navbar={{ width: 200, breakpoint: 'sm' }}>
            <AppShell.Navbar p={0} style={{ backgroundColor: 'hsla(50, 25%, 96%)' }}>
              <SideMenu />
            </AppShell.Navbar>

            <AppShell.Main style={{ backgroundColor: 'hsla(50, 25%, 96%)' }}>
              <div style={{ height: 'calc(100vh - 5px)', width: '100%', overflow: 'hidden' }}>{children}</div>
            </AppShell.Main>
          </AppShell>
        </ClerkAuthContextProvider>
      </ClerkProvider>
    </MantineProvider>
  );
}
