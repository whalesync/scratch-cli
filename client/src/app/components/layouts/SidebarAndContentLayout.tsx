'use client';

import { trackPageView } from '@/lib/posthog';
import { AppShell } from '@mantine/core';
import '@mantine/core/styles.css';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { SideMenu } from '../SideMenu';

export default function SidebarAndContentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    // Track page views in PostHog
    trackPageView(pathname);
  }, [pathname]);

  return (
    <AppShell navbar={{ width: 50, breakpoint: 'sm' }}>
      <AppShell.Navbar p={0} style={{ backgroundColor: 'hsla(50, 25%, 96%)' }}>
        <SideMenu />
      </AppShell.Navbar>

      <AppShell.Main style={{ backgroundColor: 'hsla(50, 25%, 96%)' }}>
        <div style={{ height: 'calc(100vh)' }}>{children}</div>
      </AppShell.Main>
    </AppShell>
  );
}
