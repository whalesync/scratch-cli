import { expect, test as setup } from '@playwright/test';

const authFile = '.auth/user.json';

/**
 * Global setup for all Playwright tests
 * Signs in via the Clerk UI and saves authentication state
 *
 * This approach uses traditional form interaction rather than Clerk's testing helpers
 * which can be more reliable for apps with all protected routes
 */
setup('authenticate', async ({ page }) => {
  // Get test user credentials
  const testEmail = process.env.E2E_TEST_USER_EMAIL;
  const testPassword = process.env.E2E_TEST_USER_PASSWORD;

  if (!testEmail || !testPassword) {
    throw new Error('E2E_TEST_USER_EMAIL and E2E_TEST_USER_PASSWORD must be set in environment variables');
  }

  console.log('Navigating to app...');
  // Navigate to the app (will redirect to Clerk sign-in)
  await page.goto('/');

  console.log('Waiting for sign-in page...');
  // Wait for redirect to Clerk sign-in page
  await page.waitForURL(/sign-in/, { timeout: 10000 });

  console.log('Filling in email...');
  // Fill in email/username field
  const emailInput = page.locator('input[name="identifier"]');
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill(testEmail);

  console.log('Clicking Continue button (after email)...');
  // Click the primary Continue button (not the "Continue with Google" button)
  // The Continue button has the class "cl-formButtonPrimary"
  const continueButton = page.locator('button.cl-formButtonPrimary');
  await continueButton.click();

  console.log('Waiting for password field...');
  // Wait for password field to appear
  const passwordInput = page.locator('input[name="password"]');
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });

  console.log('Filling in password...');
  await passwordInput.fill(testPassword);

  console.log('Clicking Continue button (after password)...');
  // Click the primary Continue button to sign in
  const signInButton = page.locator('button.cl-formButtonPrimary');
  await signInButton.click();

  console.log('Waiting for authentication to complete...');
  // Wait for redirect back to app (should redirect to home page)
  await page.waitForURL(/localhost:3000\/(?!.*sign-in)/, { timeout: 30000 });

  console.log('Verifying authentication...');
  // Wait for DOM to be loaded (more reliable than networkidle for apps with real-time features)
  await page.waitForLoadState('domcontentloaded');

  // Verify we're not on sign-in page anymore
  expect(page.url()).not.toContain('sign-in');

  console.log('Saving authentication state...');
  // Save authenticated state to file
  await page.context().storageState({ path: authFile });

  console.log('✓ Authentication state saved to', authFile);
});
