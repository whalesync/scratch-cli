export enum ScratchpadPlanType {
  STARTER_PLAN = 'STARTER_PLAN',
}

export interface CreateCustomerPortalUrlResponse {
  /** Url to redirect the user to. */
  url: string;
}

export interface CreateCheckoutSessionResponse {
  /** Url to redirect the user to. */
  url: string;
}
