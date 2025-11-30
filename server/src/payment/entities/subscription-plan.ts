import { ScratchpadPlanType, SubscriptionPlan, SubscriptionPlanFeatures } from '@spinner/shared-types';
import { Plan, PlanFeatures } from '../plans';

export class SubscriptionPlanFeaturesEntity implements SubscriptionPlanFeatures {
  availableModels: string[];
  publishingLimit: number;
  creditLimit: number;
  allowPersonalKeys: boolean;
  dataSourcePerServiceLimit: number;

  constructor(features: PlanFeatures) {
    this.availableModels = features.availableModels;
    this.publishingLimit = features.publishingLimit;
    this.creditLimit = features.creditLimit;
    this.allowPersonalKeys = features.allowPersonalKeys;
    this.dataSourcePerServiceLimit = features.dataSourcePerServiceLimit;
  }
}

export class SubscriptionPlanEntity implements SubscriptionPlan {
  productType: ScratchpadPlanType;
  displayName: string;
  popular: boolean;
  costUSD: number;
  features: SubscriptionPlanFeatures;

  constructor(plan: Plan) {
    this.productType = plan.productType;
    this.displayName = plan.displayName;
    this.popular = plan.popular;
    this.costUSD = plan.costUSD;
    this.features = new SubscriptionPlanFeaturesEntity(plan.features);
  }
}
