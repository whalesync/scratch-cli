export enum ScratchpadProductType {
  STARTER_PLAN = 'STARTER',
}

interface Product {
  productType: ScratchpadProductType;
  stripeProductId: string;
  stripePriceId: string;
}

export const PRODUCTION_PRODUCTS: Product[] = [
  {
    productType: ScratchpadProductType.STARTER_PLAN,
    stripeProductId: 'undefined',
    stripePriceId: 'undefined',
  },
];

// Configured in the Scratchpad Test sandbox environment
export const TEST_PRODUCTS: Product[] = [
  {
    productType: ScratchpadProductType.STARTER_PLAN,
    stripeProductId: 'prod_SzjspoHsFMwO9u',
    stripePriceId: 'price_1S3kOVBbfpTzkWN95qTmKHz3',
  },
];
