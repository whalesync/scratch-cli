import {
  CreateCheckoutSessionResponse,
  CreateCustomerPortalUrlResponse,
  CreatePortalDto,
} from '@/types/server-entities/payment';
import { SubscriptionPlan } from '@spinner/shared-types';
import { API_CONFIG } from './config';
import { checkForApiError } from './error';

export const paymentApi = {
  createCustomerPortalUrl: async (dto: CreatePortalDto): Promise<CreateCustomerPortalUrlResponse> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/payment/portal`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    });
    await checkForApiError(res, 'Failed to create customer portal url');
    return res.json();
  },

  createCheckoutSession: async (planType: string): Promise<CreateCheckoutSessionResponse> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/payment/checkout/${planType}`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    await checkForApiError(res, `Failed to create checkout session for ${planType}`);
    return res.json();
  },

  listPlans: async (): Promise<SubscriptionPlan[]> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/payment/plans`, {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    await checkForApiError(res, 'Failed to list billing plans');
    return res.json();
  },
};
