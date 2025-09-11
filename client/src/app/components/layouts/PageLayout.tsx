'use client';

import { SideMenu } from '@/app/components/SideMenu';
import { trackPageView } from '@/lib/posthog';
import { useLayoutManagerStore } from '@/stores/layout-manager-store';
import { AppShell, AppShellProps, Box } from '@mantine/core';
import '@mantine/core/styles.css';
import { useDisclosure } from '@mantine/hooks';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

type PageLayoutProps = {
  children: React.ReactNode; // the main content of the page
  footer?: React.ReactNode;
  aside?: React.ReactNode;
};

const FOOTER_HEIGHT = 30;
const ASIDE_WIDTH = 300;
const NAVBAR_WIDTH = 50;

export const PageLayout = ({ children, footer, aside }: PageLayoutProps) => {
  const pathname = usePathname();
  const { navbarOpened } = useLayoutManagerStore();
  // todo track the sidebar status and the aside status through hooks and local storage
  const [asideOpened] = useDisclosure(true);

  useEffect(() => {
    // Track page views in PostHog
    trackPageView(pathname);
  }, [pathname]);

  const footerConfig: AppShellProps['footer'] = {
    height: FOOTER_HEIGHT,
    collapsed: footer ? false : true,
  };

  const asideConfig: AppShellProps['aside'] = {
    width: ASIDE_WIDTH,
    breakpoint: 'sm',
    collapsed: { desktop: aside && asideOpened ? false : true, mobile: aside && asideOpened ? false : true },
  };

  const navbarConfig: AppShellProps['navbar'] = {
    width: NAVBAR_WIDTH,
    breakpoint: 'sm',
    collapsed: { desktop: navbarOpened ? false : true, mobile: navbarOpened ? false : true },
  };

  // set a fixed height so children can be styled with 100% height
  let mainContentHeight = `calc(100vh)`;
  if (footer) {
    mainContentHeight = `calc(100vh - ${FOOTER_HEIGHT}px - 5px)`;
  }

  return (
    <AppShell navbar={navbarConfig} footer={footerConfig} aside={asideConfig}>
      <AppShell.Navbar p={0}>
        <SideMenu />
      </AppShell.Navbar>

      <AppShell.Main bg="hsla(50, 25%, 96%)">
        <Box h={mainContentHeight}>{children}</Box>
      </AppShell.Main>
      {footer && <AppShell.Footer p={0}>{footer}</AppShell.Footer>}
      {aside && <AppShell.Aside p={0}>{aside}</AppShell.Aside>}
    </AppShell>
  );
};
