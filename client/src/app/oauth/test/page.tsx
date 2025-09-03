'use client';

import { initiateOAuth } from '@/utils/oauth';
import { Button, Container, Stack, Text, Title } from '@mantine/core';
import { useState } from 'react';

export default function OAuthTestPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleTestNotionOAuth = async () => {
    setIsLoading(true);
    try {
      await initiateOAuth('notion');
    } catch (error) {
      console.error('OAuth initiation failed:', error);
      alert('OAuth initiation failed. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Title order={1}>OAuth Test Page</Title>
        <Text>This page is for testing the OAuth flow. Click the button below to test Notion OAuth.</Text>
        <Text size="sm" c="dimmed">
          Note: Make sure the Notion OAuth app is configured with the correct redirect URI:
          <br />
          <code>{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/oauth/callback</code>
        </Text>
        <Button onClick={handleTestNotionOAuth} loading={isLoading} size="lg">
          Test Notion OAuth
        </Button>
        <Text size="sm" c="dimmed">
          After clicking, you&lsquo;ll be redirected to Notion for authorization, then back to the callback page.
        </Text>
      </Stack>
    </Container>
  );
}
