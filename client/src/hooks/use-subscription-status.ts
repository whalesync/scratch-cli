import { Flavor, getBuildFlavor } from "@/utils/build";
import { useScratchPadUser } from "./useScratchpadUser";


export interface SubscriptionStatus {
    isSubscribed: boolean;
    status: 'valid' | 'expired' | 'payment_failed' | 'none';
    planDisplayName: string;
    daysRemaining: number;
}

export function useSubscriptionStatus() {
  const { user } = useScratchPadUser();

  if(!user){
    return {
      isSubscribed: false,
      status: 'none',
      planDisplayName: 'No Plan',
      daysRemaining: 0,
    };
  }

  if(process.env.SKIP_PAYWALL_FOR_LOCALHOST === 'true' && getBuildFlavor() === Flavor.Local){
    return {
      isSubscribed: true,
      status: 'valid',
      planDisplayName: 'Fake Dev Plan',
      daysRemaining: 30,
    };
  }

  if(!user.subscription){
    return {
      isSubscribed: false,
      status: 'none',
      planDisplayName: 'No Plan',
      daysRemaining: 0,
    };
  }

  const status = user.subscription.status;
  if(status === 'expired' || status === 'payment_failed'){
    return {
      isSubscribed: false,
      status,
      planDisplayName: user.subscription.planDisplayName,
      daysRemaining: 0,
    };
  }


  return {
    isSubscribed: true,
    status,
    planDisplayName: user.subscription.planDisplayName,
    daysRemaining: user.subscription.daysRemaining,
  };
}