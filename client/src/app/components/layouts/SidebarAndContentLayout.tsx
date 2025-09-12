'use client';

import { trackPageView } from '@/lib/posthog';
import { AppShell } from '@mantine/core';
import '@mantine/core/styles.css';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { NavMenu } from '../NavMenu';
import { SubscriptionVerifier } from '../SubscriptionVerifier';

export default function SidebarAndContentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    // Track page views in PostHog
    trackPageView(pathname);
  }, [pathname]);

  return (
    <SubscriptionVerifier>
      <AppShell navbar={{ width: 40, breakpoint: 'sm' }}>
        <AppShell.Navbar p={0} style={{ backgroundColor: 'hsla(50, 25%, 96%)' }}>
          <NavMenu />
        </AppShell.Navbar>

        <AppShell.Main style={{ backgroundColor: 'hsla(50, 25%, 96%)' }}>
          <div style={{ height: 'calc(100vh)' }}>{children}</div>
        </AppShell.Main>
      </AppShell>
    </SubscriptionVerifier>
  );
}
