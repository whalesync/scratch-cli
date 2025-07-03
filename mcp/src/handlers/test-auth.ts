import { API_CONFIG } from "../lib/api/config.js";

export const TEST_AUTH_MCP_TOOL_DEFINITION = {
  name: "test_auth",
  description: "Test the Scratchpad API token",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
};

export const testAuth = async () => {
  try {
    const response = await fetch(`${API_CONFIG.getApiUrl()}/test/auth`, {
      method: "GET",
      headers: {
        ...API_CONFIG.getAuthHeaders(),
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return {
      content: [
        {
          type: "text",
          text: `API key is valid:\n\n${JSON.stringify(
            response.json(),
            null,
            2
          )}`,
        },
        {
          type: "text",
          text: `Successfully connected to ${API_CONFIG.getApiUrl()}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error testing API token: ${error}`,
        },
      ],
    };
  }
};
