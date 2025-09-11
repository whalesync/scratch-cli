'use client';

import { Flex, Group } from '@mantine/core';
import { useViewportSize } from '@mantine/hooks';

/*
 * These pages don't require a subscription and should not have full UI layout as they are just executed
 * to redirect to the Stripe billing portal.
 */
export default function SubscriptionRedirectLayout({ children }: { children: React.ReactNode }) {
  const { height, width } = useViewportSize();
  return (
    <Flex justify="center" align="center" h={height} w={width}>
      <Group gap="xs">{children}</Group>
    </Flex>
  );
}
