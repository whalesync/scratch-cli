'use client';

import { trackPageView } from '@/lib/posthog';
import { useLayoutManagerStore } from '@/stores/layout-manager-store';
import { AppShell, AppShellProps, Box } from '@mantine/core';
import '@mantine/core/styles.css';
import { useDisclosure } from '@mantine/hooks';
import Head from 'next/head';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { NavMenu } from '../NavMenu';
import { SubscriptionVerifier } from '../SubscriptionVerifier';

export type PageLayoutProps = {
  children: React.ReactNode; // the main content of the page
  footer?: React.ReactNode;
  aside?: React.ReactNode;
  pageTitle?: string;
};

const FOOTER_HEIGHT = 30;
const ASIDE_WIDTH = 500;
const NAVBAR_WIDTH = 40;

export const PageLayout = ({ children, footer, aside, pageTitle }: PageLayoutProps) => {
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
      {pageTitle && (
        <Head>
          <title>{pageTitle}</title>
        </Head>
      )}
      <AppShell.Navbar p={0}>
        <NavMenu />
      </AppShell.Navbar>

      <AppShell.Main bg="hsla(50, 25%, 96%)">
        <SubscriptionVerifier>
          <Box h={mainContentHeight}>{children}</Box>
        </SubscriptionVerifier>
      </AppShell.Main>
      {footer && <AppShell.Footer p={0}>{footer}</AppShell.Footer>}
      {aside && <AppShell.Aside p={0}>{aside}</AppShell.Aside>}
    </AppShell>
  );
};
