import { expect, test } from '@playwright/test';

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

  test('should navigate to workbook page', async ({ page }) => {
    // Navigate to workbook page - this will redirect to a specific workbook
    await page.goto('/workbook');

    // Wait for DOM to be loaded
    await page.waitForLoadState('domcontentloaded');

    // Check that we're on a workbook page
    expect(page.url()).toContain('/workbook');
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
