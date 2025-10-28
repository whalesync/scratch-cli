import { ScratchpadConfigService, ScratchpadEnvironment } from 'src/config/scratchpad-config.service';

export enum ScratchpadPlanType {
  STARTER_PLAN = 'STARTER_PLAN',
}

export function getPlanTypeFromString(productTypeString: string): ScratchpadPlanType | undefined {
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

// Configured in the Scratchpaper Test sandbox environment for developer testing
export const TEST_SANDBOX_PLANS: Plan[] = [
  {
    productType: ScratchpadPlanType.STARTER_PLAN,
    displayName: 'Starter Plan',
    stripeProductId: 'prod_TJwkWAQpH8r9SN',
    stripePriceId: 'price_1SNIqoBdRE0kMHNqXMro86f7',
  },
];

// Configured in the Scratchpaper Staging sandbox environment for developer testing
export const STAGING_SANDBOX_PLANS: Plan[] = [
  {
    productType: ScratchpadPlanType.STARTER_PLAN,
    displayName: 'Starter Plan',
    stripeProductId: 'prod_TJx9oObCoL9wzG',
    stripePriceId: 'price_1SNJFZPd1pp0ErHMuu2YSlqr',
  },
];

// Configured in the Stripe Production environment
export const PRODUCTION_PLANS: Plan[] = [
  {
    productType: ScratchpadPlanType.STARTER_PLAN,
    displayName: 'Starter Plan',
    stripeProductId: 'prod_TJwgFco1IuBojy',
    stripePriceId: 'price_1SNIn6BuGFTHqsGmgevqrcez',
  },
];

export function getPlans(environment: ScratchpadEnvironment): Plan[] {
  if (environment === 'production') {
    return PRODUCTION_PLANS;
  } else if (environment === 'staging') {
    return STAGING_SANDBOX_PLANS;
  }
  return TEST_SANDBOX_PLANS;
}

export function getPlan(productType: ScratchpadPlanType): Plan | undefined {
  return getPlans(ScratchpadConfigService.getScratchpadEnvironment()).find((p) => p.productType === productType);
}
