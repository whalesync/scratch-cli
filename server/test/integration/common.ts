/**
 * Common configuration for integration tests
 */

import { createClerkClient } from '@clerk/backend';
const clientDomain = process.env.INTEGRATION_TEST_CLIENT_DOMAIN || 'test.scratch.md';
const apiDomain = process.env.INTEGRATION_TEST_API_DOMAIN || 'test-api.scratch.md';
const agentDomain = process.env.INTEGRATION_TEST_AGENT_DOMAIN || 'test-agent.scratch.md';

export const getProtocol = (domain: string): string => {
  if (domain.includes('://')) {
    return '';
  }
  return domain.includes('localhost') ? 'http://' : 'https://';
};

export const getProtocolWebsocket = (domain: string): string => {
  if (domain.includes('://')) {
    return '';
  }
  return domain.includes('localhost') ? 'ws://' : 'wss://';
};

export const getClientUrl = () => `${getProtocol(clientDomain)}${clientDomain}`;
export const getApiUrl = () => `${getProtocol(apiDomain)}${apiDomain}`;
export const getAgentUrl = () => `${getProtocol(agentDomain)}${agentDomain}`;
export const getAgentWebSocketUrl = () => `${getProtocolWebsocket(agentDomain)}${agentDomain}`;

// Cache for auth token to avoid fetching it multiple times
let cachedAuthToken: string | null = null;
let cachedUserId: string | null = null;

export interface AuthConfig {
  authToken: string;
  userId: string;
}

/**
 * Gets or creates a Clerk auth token for integration tests.
 * The token is cached for the duration of the test run.
 */
export async function getAuthToken(): Promise<AuthConfig> {
  if (cachedAuthToken && cachedUserId) {
    return { authToken: cachedAuthToken, userId: cachedUserId };
  }

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    throw new Error('You need to set this variable to run the smoke tests: CLERK_SECRET_KEY');
  }

  const userId = process.env.INTEGRATION_TEST_USER_ID;
  if (!userId) {
    throw new Error('You need to set this variable to run the smoke tests: INTEGRATION_TEST_USER_ID');
  }

  const clerkClient = createClerkClient({ secretKey: clerkSecretKey });

  // Get an active session for the test user or create one
  const sessions = await clerkClient.sessions.getSessionList({ userId });

  let sessionId: string;
  if (sessions.data.length > 0 && sessions.data[0].status === 'active') {
    // Use existing active session
    const session = sessions.data[0];
    sessionId = session.id;
    console.log(`Using existing Clerk session: ${JSON.stringify(session)}`);
  } else {
    // Create a new session for the test user
    const session = await clerkClient.sessions.createSession({
      userId,
    });
    sessionId = session.id;
    console.log(`Created new Clerk session ${sessionId}`);
  }

  // Get the JWT token from the session (using default template)
  const tokenResponse = await clerkClient.sessions.getToken(sessionId, '');

  // Cache the results
  cachedAuthToken = tokenResponse.jwt;
  cachedUserId = userId;

  return { authToken: cachedAuthToken, userId: cachedUserId };
}
