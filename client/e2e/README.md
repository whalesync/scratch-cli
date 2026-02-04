# End-to-End Testing with Playwright

This directory contains end-to-end (E2E) tests for the Scratch client application using [Playwright](https://playwright.dev) with Clerk authentication integration.

## Table of Contents

- [Setup](#setup)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Authentication](#authentication)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Setup

### 1. Install Dependencies

From the `/client` directory:

```bash
nvm use
yarn install
yarn playwright install --with-deps
```

### 2. Configure Environment Variables

Create a `.env.test` file in the `/client` directory (use `.env.test.example` as a template):

```bash
# Clerk API Keys (from Clerk Dashboard)
CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key
CLERK_SECRET_KEY=sk_test_your_secret_key

# Test User Credentials
E2E_TEST_USER_EMAIL=test@example.com
E2E_TEST_USER_PASSWORD=test_password

# Application URLs
NEXT_PUBLIC_CLIENT_URL=http://localhost:3000
NEXT_PUBLIC_SERVER_URL=http://localhost:3010
```

### 3. Create Test User in Clerk

1. Go to your Clerk Dashboard
2. Navigate to "Users" section
3. Create a new user with email/password authentication
4. Use these credentials in your `.env.test` file

## Running Tests

### Local Development

```bash
# Run all tests in headless mode
yarn test:e2e

# Run tests with UI mode (interactive)
yarn test:e2e:ui

# Run tests in headed mode (see browser)
yarn test:e2e:headed

# Debug a specific test
yarn test:e2e:debug

# View test report
yarn test:e2e:report
```

### Running Specific Tests

```bash
# Run a single test file
yarn test:e2e e2e/example.spec.ts

# Run tests matching a pattern
yarn test:e2e --grep "should load"

# Run tests in a specific browser
yarn test:e2e --project=chromium
```

### Prerequisites for Local Testing

Before running E2E tests locally, ensure:

1. **Development servers are running**:
   - Client: `yarn run dev` (port 3000)
   - Server: `cd ../server && yarn run start:dev` (port 3010)
1. **Environment variables are configured** (`.env.test` file)
1. **Test user exists in Clerk** with valid credentials

**Note**: The Playwright config includes a `webServer` option that automatically starts the dev server if it's not running. However, you'll still need the backend server running separately.

## Writing Tests

### Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    // Tests are automatically authenticated via global setup
    // No need to sign in explicitly!

    // Navigate to page
    await page.goto('/your-route');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Perform actions and assertions
    await expect(page).toHaveTitle(/Expected Title/);
  });
});
```

### Authentication Helpers (Optional)

The `/e2e/helpers/clerk-auth.ts` file provides helper functions if you need to explicitly manage auth in specific tests:

```typescript
import { signOutTestUser, isUserSignedIn } from './helpers/clerk-auth';

// Sign out current user (if testing sign-out flow)
await signOutTestUser(page);

// Check if user is signed in
const isSignedIn = await isUserSignedIn(page);
```

**Note**: Most tests don't need these helpers since authentication is handled automatically via storage state.

### Writing Tests That Require Sign-Out

If you're testing sign-out functionality or unauthenticated states:

```typescript
import { signOutTestUser } from './helpers/clerk-auth';

test.describe('Sign Out Flow', () => {
  test('should redirect to sign-in after sign-out', async ({ page }) => {
    await page.goto('/');

    // Sign out the authenticated user
    await signOutTestUser(page);

    // Try to access protected page
    await page.goto('/workbooks');

    // Should redirect to sign-in
    expect(page.url()).toContain('sign-in');
  });
});
```

### Example Test Patterns

#### Testing Navigation

```typescript
test('should navigate between pages', async ({ page }) => {
  // Navigate to workbooks (already authenticated)
  await page.goto('/workbooks');
  await expect(page).toHaveURL(/.*workbooks/);

  // Click a link
  await page.click('text=Settings');
  await expect(page).toHaveURL(/.*settings/);
});
```

#### Testing Forms

```typescript
test('should submit a form', async ({ page }) => {
  await page.goto('/form-page');

  // Fill out form
  await page.fill('input[name="title"]', 'Test Title');
  await page.fill('textarea[name="description"]', 'Test Description');

  // Submit
  await page.click('button[type="submit"]');

  // Wait for success message
  await expect(page.locator('text=Success')).toBeVisible();
});
```

#### Testing API Interactions

```typescript
test('should handle API responses', async ({ page }) => {
  // Wait for specific network request
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/workbooks') && response.status() === 200,
  );

  await page.goto('/workbooks');
  await responsePromise;

  // Verify data loaded
  await expect(page.locator('[data-testid="workbook-item"]')).toBeVisible();
});
```

## Authentication

### How It Works

Authentication uses Playwright's **storage state** pattern for maximum efficiency:

1. **Global Setup** (`e2e/global.setup.ts`): Runs once before all tests
   - Initializes Clerk testing token
   - Signs in a test user programmatically
   - Saves authentication state to `.auth/user.json`

2. **Test Execution**: All tests automatically use the saved auth state
   - No need to sign in before each test
   - Tests start already authenticated
   - Much faster test execution

3. **No Login Flow Testing**: We intentionally skip testing the login flow itself (that's Clerk's responsibility)

### Benefits of Storage State Pattern

- **Fast**: Sign in once, reuse everywhere (tests run ~10x faster)
- **Reliable**: No timing issues with repeated sign-ins
- **Simple**: Tests don't need auth setup code
- **Efficient**: Reduces load on Clerk's API

### Environment Variables Required

```bash
CLERK_PUBLISHABLE_KEY=pk_test_...  # Your Clerk publishable key
CLERK_SECRET_KEY=sk_test_...       # Your Clerk secret key
E2E_TEST_USER_EMAIL=test@example.com
E2E_TEST_USER_PASSWORD=password123
```

## Best Practices

### 1. Keep Tests Independent

Each test should be able to run independently:

```typescript
// Good: Test sets up its own data
test('should edit workbook', async ({ page }) => {
  await signInTestUser(page);
  await createTestWorkbook(page);
  // ... test logic
});

// Bad: Test depends on previous test state
test('should edit the workbook created earlier', async ({ page }) => {
  // Assumes a workbook already exists
});
```

### 2. Use Descriptive Test Names

```typescript
// Good: Descriptive test names
test('should display error message when form is submitted with empty title', async ({ page }) => {
  // ...
});

// Bad: Vague test names
test('form test', async ({ page }) => {
  // ...
});
```

### 3. Wait for Elements Properly

```typescript
// Best: Wait for specific elements to be visible
await expect(page.locator('[data-testid="workbook"]')).toBeVisible();

// Good: Wait for DOM to be ready
await page.waitForLoadState('domcontentloaded');

// Avoid: networkidle is unreliable for apps with WebSockets/real-time features
// Our app uses WebSockets and analytics which keep connections open indefinitely
// await page.waitForLoadState('networkidle'); // ❌ Don't use this - causes flaky tests!

// Bad: Hard-coded waits
await page.waitForTimeout(5000); // ❌ Avoid this
```

**Why avoid `networkidle`?**

Our app uses:

- WebSocket connections for real-time updates
- PostHog analytics with periodic requests
- Background polling and SSE

These keep the network active, so `networkidle` (which waits for 500ms of no network activity) either times out or causes flaky tests. Use `domcontentloaded` or wait for specific elements instead.

### 4. Use Data Test IDs

Add `data-testid` attributes to your components for reliable selectors:

```tsx
// In your React component
<button data-testid="create-workbook-btn">Create</button>
```

```typescript
// In your test
await page.click('[data-testid="create-workbook-btn"]');
```

### 5. Group Related Tests

```typescript
test.describe('Workbooks', () => {
  test.describe('Creating workbooks', () => {
    test('should create a new workbook', async ({ page }) => {
      // ...
    });

    test('should validate workbook title', async ({ page }) => {
      // ...
    });
  });

  test.describe('Editing workbooks', () => {
    // ...
  });
});
```

### 6. Clean Up Test Data

Consider cleaning up any test data created during tests:

```typescript
test('should create and delete workbook', async ({ page }) => {
  await signInTestUser(page);

  // Create test data
  const workbookId = await createTestWorkbook(page);

  // Test logic
  // ...

  // Clean up
  await deleteWorkbook(page, workbookId);
});
```

### 7. Use Page Object Models for Complex Pages

For pages with many interactions, consider creating page object models:

```typescript
// e2e/pages/workbooks.page.ts
export class WorkbooksPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/workbooks');
  }

  async createWorkbook(name: string) {
    await this.page.click('[data-testid="create-btn"]');
    await this.page.fill('[name="title"]', name);
    await this.page.click('[data-testid="save-btn"]');
  }
}

// In test
const workbooksPage = new WorkbooksPage(page);
await workbooksPage.goto();
await workbooksPage.createWorkbook('My Workbook');
```

## Troubleshooting

### Test Fails with "User not authenticated"

**Issue**: The test user is not signing in properly.

**Solutions**:

1. Verify `.env.test` has correct Clerk credentials
2. Check that test user exists in Clerk Dashboard
3. Try running `await clerk.loaded({ page })` after sign-in
4. Watch the test screen recording to figure out why sign in failed

### Tests Timeout Waiting for Page

**Issue**: Page takes too long to load.

**Solutions**:

1. Ensure dev servers are running (client on 3000, server on 3010)
2. Check network tab in `--headed` mode to see what's loading
3. Increase timeout in `playwright.config.ts` if needed
4. Use more specific wait conditions instead of `networkidle`

### "Browser not found" Error

**Issue**: Playwright browsers aren't installed.

**Solution**:

```bash
yarn playwright install --with-deps
```

### Tests Pass Locally but Fail in CI

**Issue**: Environment differences between local and CI.

**Solutions**:

1. Verify CI environment variables are set correctly
2. Check if CI has access to required services
3. Review CI logs for specific error messages
4. Consider if tests depend on local-only resources

### Clerk Testing Token Issues

**Issue**: Tests fail with Clerk authentication errors.

**Solutions**:

1. Verify `CLERK_SECRET_KEY` is set correctly
2. Ensure you're using development instance keys (not production)
3. Check that the test user exists and has correct permissions
4. Try regenerating your Clerk API keys

### Flaky Tests

**Issue**: Tests fail intermittently.

**Solutions**:

1. Add explicit waits for elements: `await expect(element).toBeVisible()`
2. Use `page.waitForLoadState('networkidle')` after navigation
3. Avoid hard-coded timeouts like `waitForTimeout()`
4. Check for race conditions in your application code

## Additional Resources

- [Playwright Documentation](https://playwright.dev)
- [Clerk Testing Documentation](https://clerk.com/docs/testing/playwright/overview)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Playwright Tests](https://playwright.dev/docs/debug)

## Contributing

When adding new E2E tests:

1. Follow the test structure and naming conventions shown above
2. Use authentication helpers from `clerk-auth.ts`
3. Add clear descriptions and comments
4. Ensure tests are independent and can run in any order
5. Update this README if you add new patterns or helpers
