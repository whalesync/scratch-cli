'use client';

import { FullPageLoader } from '@/app/components/FullPageLoader';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { API_CONFIG } from '@/lib/api/config';
import { trackUserSignIn } from '@/lib/posthog';
import { RouteUrls } from '@/utils/route-urls';
import { useAuth, useUser } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';
import { JSX, ReactNode, useCallback, useEffect, useState } from 'react';

const JWT_TOKEN_REFRESH_MS = 10000; // 10 seconds

/**
 * This component just makes sure the Scratchpad user is loaded from the server and that authentication is fully complete before loading protected pages
 */
export const ScratchPadUserProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const scratchPadUser = useScratchPadUser();
  const router = useRouter();
  const pathname = usePathname();
  const workbookModeActiveFlag = scratchPadUser.user?.experimentalFlags?.DEFAULT_WORKBOOK_MODE;

  useEffect(() => {
    if (scratchPadUser) {
      trackUserSignIn(scratchPadUser);
    }
  }, [scratchPadUser]);

  // Redirect to onboarding workbook if set
  useEffect(() => {
    const onboardingWorkbookId = scratchPadUser.user?.onboardingWorkbookId;
    if (onboardingWorkbookId && !pathname.startsWith('/workbooks/')) {
      router.replace(
        workbookModeActiveFlag === 'files'
          ? RouteUrls.workbookFilePageUrl(onboardingWorkbookId)
          : RouteUrls.workbookScratchSyncPageUrl(onboardingWorkbookId),
      );
    }
  }, [scratchPadUser.user?.onboardingWorkbookId, pathname, router, workbookModeActiveFlag]);

  if (scratchPadUser.isLoading) {
    return <FullPageLoader message="Loading user data..." />;
  }

  return <>{children}</>;
};

/**
 * This provider handles combining Clerk auth with Scratchpad auth.
 * It refreshes the JWT token periodically and sets the value into the API_CONFIG so all API calls can be authenticated
 */
export const ClerkAuthContextProvider = (props: { children: ReactNode }): JSX.Element => {
  const { getToken } = useAuth();
  const { isLoaded, isSignedIn } = useUser();
  const pathname = usePathname();
  const [tokenLoaded, setTokenLoaded] = useState(false);

  const loadToken = useCallback(async () => {
    /*
     * Fetch a new JWT token from Clerk SDK (likely the cookie). This has to be done using an async function
     */
    const newToken = await getToken();

    if (newToken) {
      API_CONFIG.setAuthToken(newToken);
      setTokenLoaded(true);
    }
  }, [getToken]);

  // This sets the token when the first load of the page is complete
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      // load the token any time our auth state changes
      loadToken().catch(console.error);
    }
  }, [isLoaded, isSignedIn, loadToken]);

  /*
   * Periodically refresh the JWT token so the version in authState is as recent as possible
   */
  useEffect(() => {
    const interval = setInterval(() => {
      loadToken().catch(console.error);
    }, JWT_TOKEN_REFRESH_MS);

    return () => clearInterval(interval);
  }, [loadToken]);

  /*
   * Refresh the token when the browser regains focus
   * This ensures the token is fresh when the user returns to the tab and catches situations where the interval
   * isn't running
   */
  useEffect(() => {
    const handleFocus = () => {
      if (isLoaded && isSignedIn) {
        loadToken().catch(console.error);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isLoaded, isSignedIn, loadToken]);

  if (RouteUrls.isPublicRoute(pathname)) {
    // Public pages just pass through and can get rendered w/o auth state initialized
    // NOTE: these pages should not attempt to access any user or auth data
    return <>{props.children}</>;
  }

  if (!tokenLoaded) {
    /*
     * Session not authorized and/or user is not yet identified, show a loading screen while we wait for that workflow
     *  to complete
     */
    return <FullPageLoader message="Authenticating..." />;
  }

  /*
   * Session exist, we have a valid JWT, clerk user is loaded AND whalesync user identified
   * AUTH is complete -- any dependant pages are safe to render and utilize user data
   */
  return <ScratchPadUserProvider>{props.children}</ScratchPadUserProvider>;
};
