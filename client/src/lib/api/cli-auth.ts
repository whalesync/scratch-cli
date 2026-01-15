import { API_CONFIG } from './config';

interface VerifyDeviceAuthResponse {
  success?: boolean;
  error?: string;
}

/**
 * Verify a CLI device authorization code.
 * Called from the web UI when a logged-in user enters the code.
 */
export async function verifyCliDeviceAuth(userCode: string): Promise<VerifyDeviceAuthResponse> {
  const response = await API_CONFIG.getAxiosInstance().post<VerifyDeviceAuthResponse>('/cli/v1/auth/verify', {
    userCode,
  });
  return response.data;
}
