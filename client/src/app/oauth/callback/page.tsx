'use client';

import { SecondaryButton } from '@/app/components/base/buttons';
import { oauthApi } from '@/lib/api/oauth';
import { serviceName } from '@/service-naming-conventions';
import { OAuthService } from '@/types/oauth';
import { cleanupOAuthService } from '@/utils/oauth';
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

        // Determine service from URL parameter, localStorage, or state parameter
        const serviceParam = searchParams.get('service');
        const serviceFromStorage = getServiceFromStorage();
        const serviceFromState = extractServiceFromState();

        console.debug('OAuth callback debug:', {
          serviceParam,
          serviceFromStorage,
          serviceFromState,
          state,
        });

        const service = (serviceParam as OAuthService) || serviceFromStorage || serviceFromState;

        if (!service || !isValidOAuthService(service)) {
          setState({
            status: 'error',
            message: `Unable to determine OAuth service. Found: ${service || 'none'}. Check console for debug info.`,
          });
          return;
        }

        const result = await oauthApi.callback(service, { code, state });

        setState({
          status: 'success',
          message: `Successfully connected to ${serviceName(service)}!`,
          connectorAccountId: result.connectorAccountId,
        });

        // Clean up localStorage
        cleanupOAuthService();

        // Redirect to connections page after a short delay
        setTimeout(() => {
          router.push('/connections');
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

        // Clean up localStorage on error too
        cleanupOAuthService();
      }
    };

    handleOAuthCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getServiceFromStorage = (): OAuthService | null => {
    try {
      // Try to get the service from localStorage (set when initiating OAuth)
      const storedService = localStorage.getItem('oauth_service');
      return (storedService as OAuthService) || null;
    } catch {
      return null;
    }
  };

  const extractServiceFromState = (): OAuthService | null => {
    try {
      // The state parameter contains encoded user info
      // For now, we'll need to determine the service from the URL or state
      // This is a temporary solution - in a real implementation, we might
      // encode the service name in the state parameter

      // Check if we can determine service from the current URL or other means
      // For now, we'll return null and rely on localStorage or URL params
      // TODO: Improve this to actually extract service from state or URL
      return null;
    } catch {
      return null;
    }
  };

  const isValidOAuthService = (service: string): service is OAuthService => {
    return ['NOTION', 'AIRTABLE', 'YOUTUBE'].includes(service);
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
              <SecondaryButton onClick={() => router.push('/connections')}>Back to Connections</SecondaryButton>
              {/* <PrimaryButton onClick={() => router.push('/oauth/test')}>Try Again</PrimaryButton> */}
            </Group>
          </>
        )}
      </Stack>
    </Container>
  );
}
