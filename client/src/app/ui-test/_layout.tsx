import '@/app/globals.css';
import '@mantine/notifications/styles.css';

import { SubscriptionVerifier } from '@/app/components/SubscriptionVerifier';

export default function TestLayout({ children }: { children: React.ReactNode }) {
  return <SubscriptionVerifier>{children}</SubscriptionVerifier>;
}
