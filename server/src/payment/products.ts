import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';

export enum ScratchpadProductType {
  STARTER_PLAN = 'STARTER_PLAN',
}

export function getProductTypeFromString(productTypeString: string): ScratchpadProductType | undefined {
  for (const [k, v] of Object.entries(ScratchpadProductType)) {
    if (k === productTypeString) {
      return v;
    }
  }
  return undefined;
}

export interface Product {
  productType: ScratchpadProductType;
  displayName: string;
  stripeProductId: string;
  stripePriceId: string;
}

export const PRODUCTION_PRODUCTS: Product[] = [
  {
    productType: ScratchpadProductType.STARTER_PLAN,
    displayName: 'Starter Plan',
    stripeProductId: 'undefined',
    stripePriceId: 'undefined',
  },
];

// Configured in the Scratchpad Test sandbox environment
export const TEST_PRODUCTS: Product[] = [
  {
    productType: ScratchpadProductType.STARTER_PLAN,
    displayName: 'Starter Plan',
    stripeProductId: 'prod_SzjspoHsFMwO9u',
    stripePriceId: 'price_1S3kOVBbfpTzkWN95qTmKHz3',
  },
];

export function getProduct(productType: ScratchpadProductType): Product | undefined {
  const products =
    ScratchpadConfigService.getScratchpadEnvironment() === 'production' ? PRODUCTION_PRODUCTS : TEST_PRODUCTS;

  return products.find((p) => p.productType === productType);
}
