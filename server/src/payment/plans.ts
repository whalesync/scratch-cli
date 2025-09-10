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

// Configured in the Stripe Production environment
export const PRODUCTION_PLANS: Plan[] = [
  {
    productType: ScratchpadPlanType.STARTER_PLAN,
    displayName: 'Starter Plan',
    stripeProductId: 'prod_T1CHvH0R13leag',
    stripePriceId: 'price_1S59tCB3kcxQq5fulhgRPJud',
  },
];

// Configured in the Stripe Test Mode environment
export const TEST_PLANS: Plan[] = [
  {
    productType: ScratchpadPlanType.STARTER_PLAN,
    displayName: 'Starter Plan',
    stripeProductId: 'prod_T1BiiybeaAM031',
    stripePriceId: 'price_1S59L4B3kcxQq5fuyUONF3u8',
  },
];

// Configured in the Scratchpaper Test sandbox environment for developer testing
export const SANDBOX_PLANS: Plan[] = [
  {
    productType: ScratchpadPlanType.STARTER_PLAN,
    displayName: 'Starter Plan',
    stripeProductId: 'prod_SzjspoHsFMwO9u',
    stripePriceId: 'price_1S3kOVBbfpTzkWN95qTmKHz3',
  },
];

export function getPlans(environment: ScratchpadEnvironment): Plan[] {
  if (environment === 'production') {
    return PRODUCTION_PLANS;
  } else if (environment === 'test') {
    return TEST_PLANS;
  }
  return SANDBOX_PLANS;
}

export function getPlan(productType: ScratchpadPlanType): Plan | undefined {
  return getPlans(ScratchpadConfigService.getScratchpadEnvironment()).find((p) => p.productType === productType);
}
