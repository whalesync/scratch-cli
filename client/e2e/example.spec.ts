import { test, expect } from '@playwright/test';

/**
 * Example test suite demonstrating basic Playwright + Clerk authentication
 *
 * This test suite shows:
 * - Basic navigation and page assertions
 * - How to structure tests for maintainability
 *
 * Note: Authentication is handled automatically via saved auth state
 * from the global setup file. All tests run with an authenticated user.
 */
test.describe('Example Test Suite', () => {
  test('should load the home page', async ({ page }) => {
    // Navigate to home page
    await page.goto('/');

    // Wait for DOM to be loaded (more reliable than networkidle for apps with WebSockets/analytics)
    await page.waitForLoadState('domcontentloaded');

    // Basic assertion - page should be accessible
    expect(page.url()).toContain('localhost:3000');
  });

  test('should navigate to workbooks page', async ({ page }) => {
    // Navigate to workbooks page
    await page.goto('/workbooks');

    // Wait for DOM to be loaded
    await page.waitForLoadState('domcontentloaded');

    // Check that we're on the workbooks page
    expect(page.url()).toContain('/workbooks');
  });

  test('should navigate to data sources page', async ({ page }) => {
    // Navigate to data sources page
    await page.goto('/data-sources');

    // Wait for DOM to be loaded
    await page.waitForLoadState('domcontentloaded');

    // Verify we're on the data sources page
    expect(page.url()).toContain('/data-sources');
  });
});
