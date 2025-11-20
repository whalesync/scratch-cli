import { test, expect } from '@playwright/test';

/**
 * Health check test suite
 *
 * This test suite demonstrates:
 * - API health check testing
 * - How to structure simple smoke tests
 *
 * Note: Authentication is handled automatically via saved auth state
 * from the global setup file.
 */
test.describe('Health Checks', () => {
  test('health endpoint should be accessible', async ({ page }) => {
    // Navigate to health page (already authenticated via global setup)
    await page.goto('/health');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Verify we can access the health page
    expect(page.url()).toContain('/health');
  });

  test('should verify server is running', async ({ request }) => {
    // Check if the API server is accessible
    // This uses the request context instead of page for API testing
    const response = await request.get(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3010');

    // Server should respond (even if it returns 404 for root, it's responding)
    expect(response.status()).toBeLessThan(500);
  });
});
