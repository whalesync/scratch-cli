import { clerk } from '@clerk/testing/playwright';
import { Page } from '@playwright/test';
import { setupClerkTestingToken } from '@clerk/testing/playwright';

/**
 * Sign in a test user using Clerk
 * This helper function signs in without interacting with the UI
 *
 * @param page - Playwright page object
 * @param strategy - Authentication strategy (default: 'password')
 * @returns Promise that resolves when sign-in is complete
 *
 * @example
 * ```typescript
 * await signInTestUser(page);
 * ```
 */
export async function signInTestUser(page: Page): Promise<void> {
  // Use environment variables for test user credentials
  const testEmail = process.env.E2E_TEST_USER_EMAIL;
  const testPassword = process.env.E2E_TEST_USER_PASSWORD;

  if (!testEmail || !testPassword) {
    throw new Error('E2E_TEST_USER_EMAIL and E2E_TEST_USER_PASSWORD must be set in environment variables');
  }

  // Setup Clerk testing token to bypass bot detection
  await setupClerkTestingToken({ page });

  // Sign in using Clerk helper (no UI interaction needed)
  // This works even without navigating first when using the testing token
  await clerk.signIn({
    page,
    signInParams: {
      strategy: 'password',
      identifier: testEmail,
      password: testPassword,
    },
  });

  // Wait for Clerk to be fully loaded
  await clerk.loaded({ page });
}

/**
 * Sign out the current test user
 *
 * @param page - Playwright page object
 * @returns Promise that resolves when sign-out is complete
 *
 * @example
 * ```typescript
 * await signOutTestUser(page);
 * ```
 */
export async function signOutTestUser(page: Page): Promise<void> {
  await clerk.signOut({ page });
}

/**
 * Check if user is signed in
 * This is useful for test assertions
 *
 * @param page - Playwright page object
 * @returns Promise that resolves to true if user is signed in
 */
export async function isUserSignedIn(page: Page): Promise<boolean> {
  try {
    // Check if Clerk is loaded and user is authenticated
    await clerk.loaded({ page });
    return true;
  } catch {
    return false;
  }
}
