import { CreateCheckoutSessionResponse, CreateCustomerPortalUrlResponse } from "@/types/server-entities/payment";
import { API_CONFIG } from "./config";

export const paymentApi = {

  createCustomerPortalUrl: async (): Promise<CreateCustomerPortalUrlResponse> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/payment/portal`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(res.statusText ?? `Failed to create customer portal url`);
    }

    return res.json();
  },

  createCheckoutSession: async (productType: string): Promise<CreateCheckoutSessionResponse> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/payment/checkout/${productType}`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(res.statusText ?? `Failed to create checkout session for ${productType}`);
    }

    return res.json();
  },
};