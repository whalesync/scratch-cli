import { ScratchpadPlanType } from '@spinner/shared-types';
import { ScratchpadConfigService, ScratchpadEnvironment } from 'src/config/scratchpad-config.service';

export { ScratchpadPlanType } from '@spinner/shared-types';

export function getPlanTypeFromString(productTypeString: string): ScratchpadPlanType | undefined {
  for (const [k, v] of Object.entries(ScratchpadPlanType)) {
    if (k === productTypeString) {
      return v;
    }
  }
  return undefined;
}

export interface PlanFeatures {
  // The limited set of models that the user can use. If the array is empty, all models are available.
  availableModels: string[];
  // The maximum number of publishing actions that the user can perform. 0 means unlimited.
  publishingLimit: number;
  // The maximum number of credits that the user can use. 0 means unlimited.
  creditLimit: number;
  // The frequency at which the user's credits are reset.
  creditReset: 'daily' | 'weekly' | 'monthly' | 'never';
  // Whether the user is allowed to use personal OpenRouter API keys and create custom credentials
  allowPersonalKeys: boolean;
  // The maximum number of data sources per service that the user can use. 0 means unlimited.
  dataSourcePerServiceLimit: number;
}

export interface Plan {
  productType: ScratchpadPlanType;
  displayName: string;
  stripeProductId: string;
  stripePriceId: string;
  popular: boolean;
  hidden: boolean;
  features: PlanFeatures;
}

/**
 * Free Plan
 *
 * This plan is doesn't actually exist on Stripe and is the default plan for users who don't have a subscription.
 *
 * Once a user has a subscription (active or expired), they never go back to the free plan.
 */
export const FREE_PLAN: Plan = {
  productType: ScratchpadPlanType.FREE_PLAN,
  displayName: 'Free',
  stripeProductId: 'free_plan',
  stripePriceId: 'free_plan',
  popular: false,
  hidden: false,
  features: {
    availableModels: ['openai/gpt-4o-mini', 'openai/gpt-4o'],
    publishingLimit: 10,
    creditLimit: 5,
    creditReset: 'never',
    allowPersonalKeys: false,
    dataSourcePerServiceLimit: 1,
  },
};

/**
 * @deprecated
 */
export const STARTER_PLAN: Plan = {
  productType: ScratchpadPlanType.STARTER_PLAN,
  displayName: 'Starter',
  stripeProductId: '',
  stripePriceId: '',
  popular: false,
  hidden: true,
  features: {
    availableModels: [],
    publishingLimit: 10,
    creditLimit: 5,
    creditReset: 'monthly',
    allowPersonalKeys: true,
    dataSourcePerServiceLimit: 1,
  },
};

/**
 * Pro Plan
 *
 * This plan is a paid plan that allows users to use the product with unlimited publishing actions and credits.
 */
export const PRO_PLAN: Plan = {
  productType: ScratchpadPlanType.PRO_PLAN,
  displayName: 'Pro',
  stripeProductId: '', // Set differently for each environment
  stripePriceId: '', // Set differently for each environment
  popular: true,
  hidden: false,
  features: {
    availableModels: [],
    publishingLimit: 0,
    creditLimit: 10,
    creditReset: 'never',
    allowPersonalKeys: true,
    dataSourcePerServiceLimit: 1,
  },
};

export const MAX_PLAN: Plan = {
  productType: ScratchpadPlanType.MAX_PLAN,
  displayName: 'Max',
  stripeProductId: '', // Set differently for each environment
  stripePriceId: '', // Set differently for each environment
  popular: false,
  hidden: false,
  features: {
    availableModels: [],
    publishingLimit: 0,
    creditLimit: 50,
    creditReset: 'monthly',
    allowPersonalKeys: true,
    dataSourcePerServiceLimit: 0,
  },
};

// Plans configured in the Scratch Test sandbox environment for developer testing
export const TEST_SANDBOX_PLANS: Plan[] = [
  {
    ...STARTER_PLAN,
    stripeProductId: 'prod_TJwkWAQpH8r9SN',
    stripePriceId: 'price_1SNIqoBdRE0kMHNqXMro86f7',
  },
  FREE_PLAN,
  { ...PRO_PLAN, stripeProductId: 'prod_TVV4n4JqTQnENy', stripePriceId: 'price_1SYU4jBdRE0kMHNq4mMMjgWH' },
  { ...MAX_PLAN, stripeProductId: 'prod_TVV6aVZ43QYJmO', stripePriceId: 'price_1SYU6CBdRE0kMHNqr7YRm7uu' },
];

// Plans configured in the Scratch Staging sandbox environment
export const STAGING_SANDBOX_PLANS: Plan[] = [
  {
    ...STARTER_PLAN,
    stripeProductId: 'prod_TJx9oObCoL9wzG',
    stripePriceId: 'price_1SNJFZPd1pp0ErHMuu2YSlqr',
  },
  FREE_PLAN,
  { ...PRO_PLAN, stripeProductId: 'prod_TVXbDaLac1BeEs', stripePriceId: 'price_1SYWWVPd1pp0ErHMfWTsG55n' },
  { ...MAX_PLAN, stripeProductId: 'prod_TVXeZZtBUz1VRA', stripePriceId: 'price_1SYWZDPd1pp0ErHMwtBs7ycN' },
];

// Plans configured in the Stripe Production environment
export const PRODUCTION_PLANS: Plan[] = [
  {
    ...STARTER_PLAN,
    stripeProductId: 'prod_TJwgFco1IuBojy',
    stripePriceId: 'price_1SNIn6BuGFTHqsGmgevqrcez',
  },
  FREE_PLAN,
  { ...PRO_PLAN, stripeProductId: 'prod_TVXVbCVSdlGOjc', stripePriceId: 'price_1SYWQ2BuGFTHqsGmiLNoiPCv' },
  { ...MAX_PLAN, stripeProductId: 'prod_TVXUCHtF58Bzd2', stripePriceId: 'price_1SYWPuBuGFTHqsGmOtGqjM6E' },
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
