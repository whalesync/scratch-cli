'use client';

import { ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { RouteUrls } from '@/utils/route-urls';
import { Alert, Container, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { XCircle } from '@phosphor-icons/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { OAuthStatePayload } from '../../../types/server-entities/oauth';

interface OAuthCallbackState {
  status: 'loading' | 'error';
  message?: string;
  connectorAccountId?: string;
}

/**
 * This is the page that we go back to during an OAuth authorization flow after the user has just gone out to the OAuth
 * authorization screen for a provider (e.g. Webflow). It reads the original host/port that the request came from in the
 * OAuth state param, then redirects back there to finish the flow.
 *
 * e.g. If this came from `localhost`, the OAuth flow will send the browser to `test.scratch.md`, which will then
 * redirect back to `localhost`.
 */
export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<OAuthCallbackState>({ status: 'loading' });
  const hasExecuted = useRef(false);

  useEffect(() => {
    // Prevent multiple executions
    if (hasExecuted.current) {
      return;
    }
    hasExecuted.current = true;

    const handleOAuthCallback = async () => {
      try {
        // Extract OAuth parameters from URL
        const code = searchParams.get('code');
        const oAuthStateString = searchParams.get('state');

        // Validate required parameters.
        if (!code || !oAuthStateString) {
          setState({
            status: 'error',
            message: 'Missing required OAuth parameters (code or state)',
          });
          return;
        }

        const oAuthState = decodeOAuthStatePayload(oAuthStateString);
        if (!oAuthState) {
          setState({
            status: 'error',
            message: 'Error parsing required OAuth param (state)',
          });
          return;
        }

        window.location.href = `${oAuthState.redirectPrefix}/oauth/callback-step-2${window.location.search}`;
      } catch (error) {
        console.error('OAuth callback error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        setState({
          status: 'error',
          message: errorMessage,
        });
      }
    };

    handleOAuthCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decodeOAuthStatePayload = (oAuthStateString: string): OAuthStatePayload | null => {
    try {
      if (!state) return null;

      // Decode the base64 state parameter.
      return (JSON.parse(Buffer.from(oAuthStateString, 'base64').toString()) as OAuthStatePayload) || null;
    } catch {
      return null;
    }
  };

  return (
    <Container size="sm" py="xl">
      <Stack align="center" gap="lg">
        {state.status === 'loading' && (
          <>
            <Loader size="lg" />
            <Title order={2}>Connecting your account...</Title>
            <Text c="dimmed" ta="center">
              Please wait while we complete the OAuth connection.
            </Text>
          </>
        )}

        {state.status === 'error' && (
          <>
            <XCircle size={64} color="var(--mantine-color-red-6)" />
            <Title order={2} c="red">
              Connection Failed
            </Title>
            <Alert color="red" title="Error">
              {state.message}
            </Alert>
            <Text size="sm" c="dimmed" ta="center">
              You can try again or contact support if the problem persists.
            </Text>
            <Group gap="sm" mt="md">
              <ButtonSecondaryOutline onClick={() => router.push(RouteUrls.dataSourcesPageUrl)}>
                Back to Connections
              </ButtonSecondaryOutline>
            </Group>
          </>
        )}
      </Stack>
    </Container>
  );
}
