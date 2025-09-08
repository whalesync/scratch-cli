import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';

export enum ScratchpadPlanType {
  STARTER_PLAN = 'STARTER_PLAN',
}

export function getProductTypeFromString(productTypeString: string): ScratchpadPlanType | undefined {
  for (const [k, v] of Object.entries(ScratchpadPlanType)) {
    if (k === productTypeString) {
      return v;
    }
  }
  return undefined;
}

export interface Plan {
  productType: ScratchpadPlanType;
  displayName: string;
  stripeProductId: string;
  stripePriceId: string;
}

export const PRODUCTION_PLANS: Plan[] = [
  {
    productType: ScratchpadPlanType.STARTER_PLAN,
    displayName: 'Starter Plan',
    stripeProductId: 'undefined',
    stripePriceId: 'undefined',
  },
];

// Configured in the Scratchpad Test sandbox environment
export const TEST_PLANS: Plan[] = [
  {
    productType: ScratchpadPlanType.STARTER_PLAN,
    displayName: 'Starter Plan',
    stripeProductId: 'prod_SzjspoHsFMwO9u',
    stripePriceId: 'price_1S3kOVBbfpTzkWN95qTmKHz3',
  },
];

export function getPlan(productType: ScratchpadPlanType): Plan | undefined {
  const plans = ScratchpadConfigService.getScratchpadEnvironment() === 'production' ? PRODUCTION_PLANS : TEST_PLANS;
  return plans.find((p) => p.productType === productType);
}
