import { ScratchpadConfigService, ScratchpadEnvironment } from '../config/scratchpad-config.service';
import {
  getPlan,
  getPlans,
  getPlanTypeFromString,
  Plan,
  PRODUCTION_PLANS,
  ScratchpadPlanType,
  STAGING_SANDBOX_PLANS,
  TEST_SANDBOX_PLANS,
} from './plans';

describe('plans', () => {
  describe('getPlanTypeFromString', () => {
    it('should return the correct plan type for a valid string', () => {
      expect(getPlanTypeFromString('STARTER_PLAN')).toBe(ScratchpadPlanType.STARTER_PLAN);
    });

    it('should return undefined for an invalid string', () => {
      expect(getPlanTypeFromString('INVALID_PLAN')).toBeUndefined();
    });

    it('should return undefined for an empty string', () => {
      expect(getPlanTypeFromString('')).toBeUndefined();
    });

    it('should return undefined for a lowercase string', () => {
      expect(getPlanTypeFromString('starter_plan')).toBeUndefined();
    });

    it('should return undefined for a partial match', () => {
      expect(getPlanTypeFromString('STARTER')).toBeUndefined();
    });
  });

  describe('getPlans', () => {
    it('should return production plans for production environment', () => {
      const plans = getPlans('production' as ScratchpadEnvironment);
      expect(plans).toBe(PRODUCTION_PLANS);
      expect(plans).toHaveLength(1);
      expect(plans[0].productType).toBe(ScratchpadPlanType.STARTER_PLAN);
      expect(plans[0].stripeProductId).toBe('prod_TJwgFco1IuBojy');
      expect(plans[0].stripePriceId).toBe('price_1SNIn6BuGFTHqsGmgevqrcez');
    });

    it('should return staging plans for staging environment', () => {
      const plans = getPlans('staging' as ScratchpadEnvironment);
      expect(plans).toBe(STAGING_SANDBOX_PLANS);
      expect(plans).toHaveLength(1);
      expect(plans[0].productType).toBe(ScratchpadPlanType.STARTER_PLAN);
      expect(plans[0].stripeProductId).toBe('prod_TJx9oObCoL9wzG');
      expect(plans[0].stripePriceId).toBe('price_1SNJFZPd1pp0ErHMuu2YSlqr');
    });

    it('should return test plans for test environment', () => {
      const plans = getPlans('test' as ScratchpadEnvironment);
      expect(plans).toBe(TEST_SANDBOX_PLANS);
      expect(plans).toHaveLength(1);
      expect(plans[0].productType).toBe(ScratchpadPlanType.STARTER_PLAN);
      expect(plans[0].stripeProductId).toBe('prod_TJwkWAQpH8r9SN');
      expect(plans[0].stripePriceId).toBe('price_1SNIqoBdRE0kMHNqXMro86f7');
    });

    it('should return test plans for local environment', () => {
      const plans = getPlans('local' as ScratchpadEnvironment);
      expect(plans).toBe(TEST_SANDBOX_PLANS);
      expect(plans).toHaveLength(1);
    });

    it('should return test plans for any other environment', () => {
      const plans = getPlans('unknown' as ScratchpadEnvironment);
      expect(plans).toBe(TEST_SANDBOX_PLANS);
    });
  });

  describe('getPlan', () => {
    beforeEach(() => {
      // Mock the static method to return test environment
      jest.spyOn(ScratchpadConfigService, 'getScratchpadEnvironment').mockReturnValue('test');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return the correct plan for STARTER_PLAN', () => {
      const plan = getPlan(ScratchpadPlanType.STARTER_PLAN);
      expect(plan).toBeDefined();
      expect(plan?.productType).toBe(ScratchpadPlanType.STARTER_PLAN);
      expect(plan?.displayName).toBe('Starter Plan');
      expect(plan?.stripeProductId).toBe('prod_TJwkWAQpH8r9SN');
      expect(plan?.stripePriceId).toBe('price_1SNIqoBdRE0kMHNqXMro86f7');
    });

    it('should return undefined for a non-existent plan', () => {
      const plan = getPlan('NON_EXISTENT_PLAN' as ScratchpadPlanType);
      expect(plan).toBeUndefined();
    });
  });

  describe('Plan interface structure', () => {
    it('should have all required fields in production plans', () => {
      PRODUCTION_PLANS.forEach((plan: Plan) => {
        expect(plan).toHaveProperty('productType');
        expect(plan).toHaveProperty('displayName');
        expect(plan).toHaveProperty('stripeProductId');
        expect(plan).toHaveProperty('stripePriceId');
        expect(typeof plan.productType).toBe('string');
        expect(typeof plan.displayName).toBe('string');
        expect(typeof plan.stripeProductId).toBe('string');
        expect(typeof plan.stripePriceId).toBe('string');
      });
    });

    it('should have all required fields in staging plans', () => {
      STAGING_SANDBOX_PLANS.forEach((plan: Plan) => {
        expect(plan).toHaveProperty('productType');
        expect(plan).toHaveProperty('displayName');
        expect(plan).toHaveProperty('stripeProductId');
        expect(plan).toHaveProperty('stripePriceId');
      });
    });

    it('should have all required fields in test plans', () => {
      TEST_SANDBOX_PLANS.forEach((plan: Plan) => {
        expect(plan).toHaveProperty('productType');
        expect(plan).toHaveProperty('displayName');
        expect(plan).toHaveProperty('stripeProductId');
        expect(plan).toHaveProperty('stripePriceId');
      });
    });

    it('should have unique stripe product IDs across all environments', () => {
      const allPlans = [...PRODUCTION_PLANS, ...STAGING_SANDBOX_PLANS, ...TEST_SANDBOX_PLANS];
      const productIds = allPlans.map((p) => p.stripeProductId);
      const uniqueProductIds = new Set(productIds);
      expect(uniqueProductIds.size).toBe(productIds.length);
    });

    it('should have unique stripe price IDs across all environments', () => {
      const allPlans = [...PRODUCTION_PLANS, ...STAGING_SANDBOX_PLANS, ...TEST_SANDBOX_PLANS];
      const priceIds = allPlans.map((p) => p.stripePriceId);
      const uniquePriceIds = new Set(priceIds);
      expect(uniquePriceIds.size).toBe(priceIds.length);
    });

    it('should have the same display name across all environments for the same product type', () => {
      const productionPlan = PRODUCTION_PLANS.find((p) => p.productType === ScratchpadPlanType.STARTER_PLAN);
      const stagingPlan = STAGING_SANDBOX_PLANS.find((p) => p.productType === ScratchpadPlanType.STARTER_PLAN);
      const testPlan = TEST_SANDBOX_PLANS.find((p) => p.productType === ScratchpadPlanType.STARTER_PLAN);

      expect(productionPlan?.displayName).toBe('Starter Plan');
      expect(stagingPlan?.displayName).toBe('Starter Plan');
      expect(testPlan?.displayName).toBe('Starter Plan');
    });
  });

  describe('ScratchpadPlanType enum', () => {
    it('should have STARTER_PLAN defined', () => {
      expect(ScratchpadPlanType.STARTER_PLAN).toBe('STARTER_PLAN');
    });

    it('should only have expected plan types', () => {
      const planTypes = Object.values(ScratchpadPlanType);
      expect(planTypes).toHaveLength(1);
      expect(planTypes).toContain('STARTER_PLAN');
    });
  });
});
