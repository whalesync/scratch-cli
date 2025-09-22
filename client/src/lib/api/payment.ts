import { CreateCheckoutSessionResponse, CreateCustomerPortalUrlResponse } from "@/types/server-entities/payment";
import { API_CONFIG } from "./config";
import { ScratchpadApiError } from "./error";

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
      throw new ScratchpadApiError(res.statusText ?? `Failed to create customer portal url`, res.status, res.statusText);
    }

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
    if (!res.ok) {
      throw new ScratchpadApiError(res.statusText ?? `Failed to create checkout session for ${planType}`, res.status, res.statusText);
    }

    return res.json();
  },
};