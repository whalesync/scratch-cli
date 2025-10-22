'use client';

import { trackPageView } from '@/lib/posthog';
import { useLayoutManagerStore } from '@/stores/layout-manager-store';
import { Box } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import Head from 'next/head';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { NavMenu } from '../NavMenu';
import { SubscriptionVerifier } from '../SubscriptionVerifier';
import classes from './PageLayout.module.css';

export type PageLayoutProps = {
  children: React.ReactNode; // the main content of the page
  footer?: React.ReactNode;
  rightPanel?: React.ReactNode;
  pageTitle?: string;
};

export const PageLayout = ({ children, footer, rightPanel, pageTitle }: PageLayoutProps) => {
  const pathname = usePathname();
  const { navbarOpened, rightPanelOpened } = useLayoutManagerStore();

  useEffect(() => {
    // Track page views in PostHog
    trackPageView(pathname);
  }, [pathname]);

  // Set the visibility for each element
  // these data props control the visibility and positioning of the fixed elements
  const visibilityProps = {
    'data-navbar-visible': navbarOpened,
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
      <div className={classes.navBar} {...visibilityProps}>
        {navbarOpened && <NavMenu />}
      </div>
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
        <SubscriptionVerifier>
          <Box h="100%" data-internal-name="content-area-wrapper-inner">
            {children}
          </Box>
        </SubscriptionVerifier>
      </div>
    </div>
  );
};
