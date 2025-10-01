import { CreateCheckoutSessionResponse, CreateCustomerPortalUrlResponse } from "@/types/server-entities/payment";
import { API_CONFIG } from "./config";
import { checkForApiError } from "./error";

export const paymentApi = {

  createCustomerPortalUrl: async (): Promise<CreateCustomerPortalUrlResponse> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/payment/portal`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    await checkForApiError(res, "Failed to create customer portal url");
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
};