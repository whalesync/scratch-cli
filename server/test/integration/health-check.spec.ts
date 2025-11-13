import axios from 'axios';

import { getAgentUrl, getApiUrl, getClientUrl } from './common';

const healthEndpoints = [`${getClientUrl()}/api/health`, `${getApiUrl()}/health`, `${getAgentUrl()}/health`];

describe('Service Health', () => {
  // Increase test and hook timeout to allow slow external requests to succeed
  jest.setTimeout(60000);

  it.concurrent.each(healthEndpoints)('Health Endpoint: %s - should return 200 status', async (endpoint) => {
    const response = await axios.get(endpoint, {
      validateStatus: () => true, // Don't throw on any status
    });

    expect(response.status).toBe(200);
  });
});
