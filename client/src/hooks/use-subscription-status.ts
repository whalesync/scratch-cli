import { Flavor, getBuildFlavor } from '@/utils/build';
import { FLAGS } from '@/utils/flags-dev';
import { useScratchPadUser } from './useScratchpadUser';

export interface SubscriptionStatus {
  isSubscribed: boolean;
  status: 'valid' | 'expired' | 'payment_failed' | 'none';
  planDisplayName: string;
  daysRemaining: number;
  isTrial: boolean;
}

export function useSubscriptionStatus() {
  const { user } = useScratchPadUser();

  if (!user) {
    return {
      isSubscribed: false,
      status: 'none',
      planDisplayName: 'No Plan',
      daysRemaining: 0,
      isTrial: false,
    };
  }

  if (FLAGS.SKIP_PAYWALL_FOR_LOCALHOST.get() && getBuildFlavor() === Flavor.Local) {
    return {
      isSubscribed: true,
      status: 'valid',
      planDisplayName: 'Fake Dev Plan',
      daysRemaining: 30,
      isTrial: false,
    };
  }

  if (!user.subscription) {
    return {
      isSubscribed: false,
      status: 'none',
      planDisplayName: 'No Plan',
      daysRemaining: 0,
      isTrial: false,
    };
  }

  const status = user.subscription.status;
  if (status === 'expired' || status === 'payment_failed') {
    return {
      isSubscribed: false,
      status,
      planDisplayName: user.subscription.planDisplayName,
      daysRemaining: 0,
      isTrial: false,
    };
  }

  return {
    isSubscribed: true,
    status,
    planDisplayName: user.subscription.planDisplayName,
    daysRemaining: user.subscription.daysRemaining,
    isTrial: user.subscription.isTrial,
  };
}
