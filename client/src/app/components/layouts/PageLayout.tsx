'use client';

import { trackPageView } from '@/lib/posthog';
import { useLayoutManagerStore } from '@/stores/layout-manager-store';
import { Box, Drawer } from '@mantine/core';
import Head from 'next/head';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { NavMenu } from '../NavMenu';
import classes from './PageLayout.module.css';

export type PageLayoutProps = {
  children: React.ReactNode; // the main content of the page
  navVariant?: 'fixed' | 'drawer';
  footer?: React.ReactNode;
  rightPanel?: React.ReactNode;
  pageTitle?: string;
};

export const PageLayout = ({
  children,
  footer,
  rightPanel,
  pageTitle,
  navVariant: navMode = 'fixed',
}: PageLayoutProps) => {
  const pathname = usePathname();
  const rightPanelOpened = useLayoutManagerStore((state) => state.rightPanelOpened);
  const navDrawerOpened = useLayoutManagerStore((state) => state.navDrawerOpened);
  const closeNavDrawer = useLayoutManagerStore((state) => state.closeNavDrawer);

  useEffect(() => {
    // Track page views in PostHog
    trackPageView(pathname);
  }, [pathname]);

  // Set the visibility for each element
  // these data props control the visibility and positioning of the fixed elements
  const visibilityProps = {
    'data-navbar-visible': navMode === 'fixed' ? true : false,
    'data-footer-visible': footer ? true : false,
    'data-right-panel-visible': rightPanel && rightPanelOpened ? true : false,
  };

  return (
    <div className={classes.pageContainer}>
      {pageTitle && (
        <Head>
          <title>{pageTitle}</title>
        </Head>
      )}
      {navMode === 'fixed' && (
        <div className={classes.navBar} {...visibilityProps}>
          <NavMenu />
        </div>
      )}
      {navMode === 'drawer' && (
        <Drawer
          opened={navDrawerOpened}
          onClose={closeNavDrawer}
          withCloseButton={false}
          position="left"
          size="200px"
          bg="var(--bg-panel)"
          padding={0}
        >
          <Box h="100vh">
            {/* Need this box because the inner container from Drawer does not fill the height */}
            <NavMenu />
          </Box>
        </Drawer>
      )}
      {footer && (
        <div className={classes.mainFooter} {...visibilityProps}>
          {footer}
        </div>
      )}
      {rightPanel && (
        <div className={classes.rightPanel} {...visibilityProps}>
          {rightPanelOpened && rightPanel}
        </div>
      )}
      <div className={classes.contentAreaWrapper} {...visibilityProps} data-internal-name="content-area-wrapper-outer">
        <Box h="100%" data-internal-name="content-area-wrapper-inner">
          {children}
        </Box>
      </div>
    </div>
  );
};
