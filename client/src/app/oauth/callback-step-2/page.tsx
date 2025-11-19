'use client';

import { ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { oAuthApi } from '@/lib/api/oauth';
import { serviceName } from '@/service-naming-conventions';
import { OAuthService } from '@/types/oauth';
import { RouteUrls } from '@/utils/route-urls';
import { Alert, Container, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { CheckCircle, XCircle } from '@phosphor-icons/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface OAuthCallbackState {
  status: 'loading' | 'success' | 'error';
  message?: string;
  connectorAccountId?: string;
}

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
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Handle OAuth error (user denied access, etc.)
        if (error) {
          setState({
            status: 'error',
            message: errorDescription || `OAuth error: ${error}`,
          });
          return;
        }

        // Validate required parameters
        if (!code || !state) {
          setState({
            status: 'error',
            message: 'Missing required OAuth parameters (code or state)',
          });
          return;
        }

        // Determine service from URL parameter or state parameter
        const serviceParam = searchParams.get('service');
        const serviceFromState = extractServiceFromState();

        console.debug('OAuth callback debug:', {
          serviceParam,
          serviceFromState,
          state,
        });

        const service = (serviceParam as OAuthService) || serviceFromState;

        if (!service || !isValidOAuthService(service)) {
          setState({
            status: 'error',
            message: `Unable to determine OAuth service. Found: ${service || 'none'}. Check console for debug info.`,
          });
          return;
        }

        const result = await oAuthApi.callback(service, { code, state });

        setState({
          status: 'success',
          message: `Successfully connected to ${serviceName(service)}!`,
          connectorAccountId: result.connectorAccountId,
        });

        // Redirect to connections page after a short delay
        setTimeout(() => {
          router.push(RouteUrls.dataSourcesPageUrl);
        }, 1000);
      } catch (error) {
        console.error('OAuth callback error:', error);

        // Handle specific OAuth errors
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

        if (errorMessage.includes('invalid_grant') || errorMessage.includes('code has already been used')) {
          setState({
            status: 'error',
            message: 'This authorization code has already been used or has expired. Please try connecting again.',
          });
        } else {
          setState({
            status: 'error',
            message: errorMessage,
          });
        }
      }
    };

    handleOAuthCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const extractServiceFromState = (): OAuthService | null => {
    try {
      const state = searchParams.get('state');
      if (!state) return null;

      // Decode the base64 state parameter
      const decoded = atob(state);
      const parsed = JSON.parse(decoded);

      // Extract service from the parsed state
      return (parsed.service as OAuthService) || null;
    } catch {
      return null;
    }
  };

  const isValidOAuthService = (service: string): service is OAuthService => {
    return ['NOTION', 'AIRTABLE', 'YOUTUBE', 'WEBFLOW', 'WIX_BLOG'].includes(service);
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
        {state.status === 'success' && (
          <>
            <CheckCircle size={64} color="var(--mantine-color-green-6)" />
            <Title order={2} c="green">
              Connection Successful!
            </Title>
            <Text c="dimmed" ta="center">
              {state.message}
            </Text>
            <Text size="sm" c="dimmed" ta="center">
              Redirecting to connections page...
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
              {/* <PrimaryButton onClick={() => router.push('/oauth/test')}>Try Again</PrimaryButton> */}
            </Group>
          </>
        )}
      </Stack>
    </Container>
  );
}
