# Test Coverage Assessment & Tracking

Note: This is an AI-generated file to keep track of where we could improve tests.

**Last Updated**: 2025-11-13
**Overall Coverage**: ~4.4% (Server: ~8.3%, Client: ~0.4%, Python Agent: 0%)

---

## Executive Summary

The codebase has **critical test coverage gaps**. While existing tests demonstrate high quality, only 28 test files exist for 562+ source files across all codebases. Progress is being made with new utility, helper function, security, authentication, and payment tests.

### Coverage Statistics

| Codebase     | Source Files | Test Files | Coverage  |
| ------------ | ------------ | ---------- | --------- |
| Server       | 258          | 27         | ~8.3%     |
| Client       | 235          | 1          | ~0.4%     |
| Python Agent | 69           | 0          | 0%        |
| **Total**    | **562**      | **28**     | **~4.4%** |

---

## Currently Tested Areas (High Quality ✅)

These areas have excellent test coverage and should serve as models:

- ✅ **Notion rich text conversion** - 1,500+ lines of tests (`server/src/remote-service/connectors/library/notion/conversion/__tests__/`)

  - Block diffing algorithm
  - Batch operations
  - Round-trip conversions

- ✅ **Wix rich content conversion** - Comprehensive converter tests (`server/src/remote-service/connectors/library/wix/rich-content/rich-content.spec.ts`)

- ✅ **HTML minification** - 70+ test cases (`server/src/wrappers/html-minify.spec.ts`)

- ✅ **Client utility helpers** - 200+ lines covering 14 utility functions (`client/src/utils/__tests__/helpers.test.ts`)

  - String manipulation (capitalization, comparison, hashing)
  - Array operations (range, last element, type checking)
  - Data formatting (bytes, URLs)
  - Validation utilities

- ✅ **Server payment helpers** - 13 test cases covering subscription management (`server/src/payment/helpers.spec.ts`)

  - Active subscription filtering
  - Latest expiring subscription detection
  - Subscription ownership validation

- ✅ **Server payment plans** - 20 test cases covering plan configuration (`server/src/payment/plans.spec.ts`)

  - Plan type string conversion and validation
  - Environment-specific plan retrieval (production, staging, test, local)
  - Plan lookup by product type
  - Plan structure validation across all environments
  - Unique Stripe ID validation (product IDs and price IDs)
  - Display name consistency across environments

- ✅ **Server ID utilities** - 20+ test cases for typed ID system (`server/src/types/ids.spec.ts`)

  - ID generation with prefixes
  - ID validation and type checking
  - Type inference from ID strings

- ✅ **Server utility helpers** - 143 test cases across utility functions

  - Enum utilities (`server/src/utils/helpers.spec.ts`) - 12 tests
  - Duration utilities (`server/src/utils/duration.spec.ts`) - 31 tests
    - Factory functions for time units (milliseconds, seconds, minutes, hours, days)
    - Duration calculations and conversions
    - Date manipulation (before, after, inPast, inFuture)
    - Human-readable formatting
  - URL validation (`server/src/utils/urls.spec.ts`) - 26 tests
    - HTTP/HTTPS URL validation
    - Domain, subdomain, and TLD handling
    - Query strings, fragments, and ports
    - Edge cases and invalid URLs
  - Assert utilities (`server/src/utils/asserts.spec.ts`) - 7 tests
    - Exhaustive type checking
    - Unreachable code detection
  - Encryption utilities (`server/src/utils/encryption.spec.ts`) - 35 tests
    - AES-256-GCM encryption/decryption
    - String and object encryption
    - Round-trip encryption tests
    - Security properties (IV/salt randomness, key derivation)
    - Error handling (tampered data, wrong keys, invalid inputs)
    - Unicode and special character handling
  - String-to-enum conversion with case matching
  - Default value handling

- ✅ **Server Result type utilities** - 68 test cases covering Result<T> monad pattern (`server/src/types/results.spec.ts`)

  - Success result creation (ok function)
  - Error result creation (errResult with all error code helpers)
  - Type guards (isOk, isErr, isResult, isAllOk)
  - Array operations (coalesceResultArray, partitionResultArray)
  - Conversions (nullableToResult, nullableResultToResult, getValueOrThrow)
  - All 17 error helper functions (generalError, notFoundError, etc.)
  - Error metadata (cause, context, isRetriable flags)

- ✅ **Slack formatters** - 19 test cases covering Slack message formatting (`server/src/slack/slack-formatters.spec.ts`)

  - Link formatting in Slack markdown format
  - Special characters and Unicode handling
  - Query parameters and URL fragments
  - New user signup message formatting
  - Offer code handling
  - Fallback handling for missing user data

- ✅ **Snapshot utilities** - 9 test cases covering snapshot lookup functions (`server/src/snapshot/util.spec.ts`)

  - Finding snapshot tables by workspace ID (wsId)
  - Finding table specs by workspace ID
  - Handling missing tables and empty snapshots
  - Multiple table scenarios

- ✅ **CSV parser** - 22 test cases covering CSV parsing logic (`server/src/remote-service/connectors/library/csv/csv-parser.spec.ts`)

  - Basic CSV parsing with headers and rows
  - Quoted fields with commas and escaped quotes
  - Empty fields and edge cases
  - Unicode and special characters
  - Row ID generation
  - Missing or extra fields handling
  - Real-world CSV formatting scenarios

- ✅ **Auth permissions** - 16 test cases covering admin permission checks (`server/src/auth/permissions.spec.ts`)

  - Admin role with different auth types (jwt, api-token, agent-token)
  - User role permission denials
  - Edge cases (missing organization, clerk id, name/email)
  - Comprehensive auth type and role combinations
  - Auth source variations (user vs agent)

- ✅ **User token utilities** - 13 test cases covering token generation (`server/src/users/tokens.spec.ts`)

  - API token generation (32-character nanoid tokens)
  - Token uniqueness validation
  - Valid character validation (URL-safe)
  - API token expiration (6 months)
  - WebSocket token expiration (1 day)
  - Date object validation and future date checks

- ✅ **Auth type conversion** - 10 test cases covering AuthenticatedUser to Actor conversion (`server/src/auth/types.spec.ts`)

  - toActor function with all auth types (jwt, api-token, agent-token)
  - Auth source handling (user vs agent)
  - Organization ID fallback handling (null/undefined → '<empty org id>')
  - User and organization ID preservation
  - Edge cases with missing organization data

- ✅ **User type conversion** - 10 test cases covering User to Actor conversion (`server/src/users/types.spec.ts`)
  - userToActor function with complete user data
  - Organization ID fallback handling
  - User metadata exclusion from Actor objects
  - Field validation (only userId and organizationId)
  - Edge cases (unboarded users, custom settings)

- ✅ **Agent JWT generation** - 11 test cases covering JWT token generation (`server/src/agent-jwt/jwt-generator.service.spec.ts`)
  - Token generation with valid user payloads
  - Admin and user role handling
  - Config service integration (secret and expiration retrieval)
  - Custom config value usage in token signing
  - Special character and long user ID handling
  - Token uniqueness validation
  - JWT service integration verification

- ✅ **Stripe Payment Service** - 28 test cases covering payment workflows (`server/src/payment/stripe-payment.service.spec.ts`)

  - Customer management (create new customer, handle empty/special characters)
  - Trial subscription creation with 7-day trial period
  - Checkout URL generation and customer portal redirects
  - Webhook handling (checkout completed, subscription updates, invoices)
  - Webhook signature verification
  - Subscription upsert logic (create/update subscriptions)
  - Scratchpad subscription validation
  - User and organization ID validation
  - Database error handling
  - Edge cases (unknown plans, missing URLs, non-scratchpad subscriptions)

- ✅ **Passport authentication strategies** - 42 test cases covering all three auth strategies
  - **API Token Strategy** (`server/src/auth/api-token.strategy.spec.ts`) - 11 test cases
    - Valid API token validation and user lookup
    - Multiple API tokens per user handling
    - Invalid token rejection
    - Edge cases (empty token array, mismatched tokens, expired tokens)
    - Database error handling
    - Special characters and long tokens
    - User field preservation in authenticated response
  - **Agent Token Strategy** (`server/src/auth/agent-token.strategy.spec.ts`) - 15 test cases
    - Agent token format validation (key:userId)
    - Invalid agent key rejection
    - User lookup by ID
    - Token format edge cases (no colon, multiple colons, empty parts)
    - User without organization ID
    - Database error handling
    - Special characters and long user IDs
    - Auth type and source validation
  - **Clerk JWT Strategy** (`server/src/auth/clerk.strategy.spec.ts`) - 16 test cases
    - Bearer token extraction from Authorization header
    - JWT verification with Clerk
    - User creation/retrieval from Clerk payload
    - Missing/malformed authorization header handling
    - Token verification error handling (TokenVerificationError, generic errors)
    - Database error handling
    - Missing user handling
    - Optional JWT fields (fullName, primaryEmail)
    - Case-sensitive Bearer prefix validation
    - Long tokens and special characters in user data

---

## Connector Test Coverage

This section tracks test coverage for all connectors in `remote-service/connectors/library/`.

### Overview

| Connector  | Source Files | Test Files | Test Cases | Coverage | Status       |
| ---------- | ------------ | ---------- | ---------- | -------- | ------------ |
| Notion     | ~10          | 3          | ~100+      | ~30%     | ⚠️ Partial   |
| Wix        | ~8           | 1          | ~30+       | ~15%     | ⚠️ Partial   |
| CSV        | 4            | 1          | 22         | ~25%     | ⚠️ Partial   |
| Webflow    | 3            | 1          | 9          | ~30%     | ⚠️ Partial   |
| Airtable   | 5            | 0          | 0          | 0%       | ❌ No tests  |
| YouTube    | 3            | 0          | 0          | 0%       | ❌ No tests  |
| WordPress  | 6            | 0          | 0          | 0%       | ❌ No tests  |
| Custom     | 2            | 0          | 0          | 0%       | ❌ No tests  |
| **Total**  | **~41**      | **6**      | **~161**   | **~15%** | **Critical** |

### Tested Areas ✅

#### Notion Connector (⚠️ Partial Coverage)
**Location**: `server/src/remote-service/connectors/library/notion/`
**Test Files**:
- `conversion/__tests__/notion-block-diff.spec.ts` - Block diffing algorithm tests
- `conversion/__tests__/notion-block-diff-executor.spec.ts` - Batch operations tests
- `conversion/__tests__/round-trip-test.spec.ts` - Round-trip conversion tests

**What's Tested**:
- ✅ Rich text conversion logic
- ✅ Block diffing algorithm
- ✅ Batch operations
- ✅ Round-trip conversions (content preservation)
- ✅ Complex nested block structures

**What's NOT Tested**:
- ❌ `notion-connector.ts` - Main connector class
- ❌ `notion-schema-parser.ts` - Schema parsing logic
- ❌ Error handling for API failures
- ❌ Authentication flows
- ❌ Table listing and preview

#### Wix Connector (⚠️ Partial Coverage)
**Location**: `server/src/remote-service/connectors/library/wix/`
**Test Files**:
- `rich-content/rich-content.spec.ts` - Rich content conversion tests

**What's Tested**:
- ✅ HTML to RICOS conversion
- ✅ RICOS to HTML conversion
- ✅ Rich text formatting preservation

**What's NOT Tested**:
- ❌ `wix-blog-connector.ts` - Main connector class
- ❌ `wix-blog-schema-parser.ts` - Schema parsing
- ❌ API integration
- ❌ Error handling

#### CSV Connector (⚠️ Partial Coverage)
**Location**: `server/src/remote-service/connectors/library/csv/`
**Test Files**:
- `csv-parser.spec.ts` - CSV parsing logic (22 test cases)

**What's Tested**:
- ✅ Basic CSV parsing with headers and rows
- ✅ Quoted fields with commas and escaped quotes
- ✅ Empty fields and edge cases
- ✅ Unicode and special characters
- ✅ Row ID generation
- ✅ Missing or extra fields handling
- ✅ Real-world CSV formatting scenarios

**What's NOT Tested**:
- ❌ `csv-connector.ts` - Main connector class
- ❌ `csv-schema-parser.ts` - Schema parsing
- ❌ File upload handling
- ❌ Error handling for malformed CSV

#### Webflow Connector (⚠️ Partial Coverage)
**Location**: `server/src/remote-service/connectors/library/webflow/`
**Test Files**:
- `webflow-connector.spec.ts` - Connector implementation tests (9 test cases)

**What's Tested**:
- ✅ `downloadTableRecords` function - Core record download logic
- ✅ Record transformation from Webflow API format to ConnectorRecord format
- ✅ Pagination handling (with pagination metadata)
- ✅ Rich text conversion (HTML to Markdown with Turndown service)
- ✅ Rich text HTML mode (when dataConverter is 'html')
- ✅ Metadata columns (isDraft, isArchived, lastPublished, lastUpdated, createdOn)
- ✅ Helper methods (displayName, getBatchSize, service type)

**What's NOT Tested**:
- ❌ `webflow-schema-parser.ts` - Schema parsing logic
- ❌ Connection testing (`testConnection` method)
- ❌ Table listing (`listTables` method)
- ❌ Table spec fetching (`fetchTableSpec` method)
- ❌ Record creation (`createRecords` method)
- ❌ Record updates (`updateRecords` method)
- ❌ Record deletion (`deleteRecords` method)
- ❌ Error extraction (`extractConnectorErrorDetails` method)
- ❌ Field conversion helper (`wsFieldsToWebflowFields` method)

### Untested Connectors ❌

#### Airtable Connector (❌ No Tests)
**Location**: `server/src/remote-service/connectors/library/airtable/`
**Source Files**:
- `airtable-connector.ts` - Main connector implementation
- `airtable-api-client.ts` - API client
- `airtable-schema-parser.ts` - Schema parser
- `airtable-spec-types.ts` - Type definitions
- `airtable-types.ts` - Airtable-specific types

**Priority Areas to Test**:
1. API client methods (listBases, getBaseSchema, getRecords)
2. Schema parsing (field type conversions)
3. Record CRUD operations
4. Error handling (API errors, rate limiting)
5. Authentication validation

#### YouTube Connector (❌ No Tests)
**Location**: `server/src/remote-service/connectors/library/youtube/`
**Source Files**:
- `youtube-connector.ts` - Main connector implementation
- `youtube-api-client.ts` - API client
- `youtube-spec-types.ts` - Type definitions

**Priority Areas to Test**:
1. API authentication (OAuth flow)
2. Video metadata retrieval
3. Channel and playlist operations
4. Error handling (quota limits, permissions)

#### WordPress Connector (❌ No Tests)
**Location**: `server/src/remote-service/connectors/library/wordpress/`
**Source Files**:
- `wordpress-connector.ts` - Main connector implementation
- `wordpress-http-client.ts` - HTTP client
- `wordpress-schema-parser.ts` - Schema parser
- `wordpress-auth-parser.ts` - Auth parsing
- `wordpress-constants.ts` - Constants
- `wordpress-types.ts` - Type definitions

**Priority Areas to Test**:
1. REST API authentication parsing
2. Post and page CRUD operations
3. Media handling
4. Schema parsing (custom post types)
5. Error handling

#### Custom Connector (❌ No Tests)
**Location**: `server/src/remote-service/connectors/library/custom/`
**Source Files**:
- `custom-connector.ts` - Custom connector implementation
- `custom-spec-types.ts` - Type definitions

**Priority Areas to Test**:
1. Custom connector execution
2. User-defined logic validation
3. Error handling
4. Security validation (prevent code injection)

### Core Connector Infrastructure

**Location**: `server/src/remote-service/connectors/`
**Source Files**:
- `connector.ts` - Base connector class
- `connectors.service.ts` - Connector service
- `connectors.module.ts` - NestJS module
- `error.ts` - Error handling utilities
- `ids.ts` - ID utilities
- `types.ts` - Shared types

**Test Status**: ❌ No tests

**Priority Areas to Test**:
1. Base Connector class methods
2. ConnectorService (connector instantiation, caching)
3. Error extraction and formatting
4. ID generation and parsing
5. Type conversions

### Connector Testing Priorities

#### 🔴 P0 - Critical (Test First)
These connectors are production-critical and handle user data:

1. **Notion Connector** - Complete connector class tests (schema parser, API client)
2. **Airtable Connector** - Full connector implementation tests
3. **Core Connector Infrastructure** - Base class and service tests

**Risk**: Data corruption, sync failures, API errors not handled properly

#### 🟡 P1 - High (Test Soon)
1. **WordPress Connector** - Authentication and CRUD operations
2. **Wix Connector** - Complete connector class tests
3. **CSV Connector** - Complete connector class tests
4. **Webflow Connector** - Complete remaining methods (schema parser, CRUD operations)

**Risk**: Common integrations may break

#### 🟢 P2 - Medium (Nice to Have)
1. **YouTube Connector** - Full implementation tests

**Risk**: Less common integrations

#### 🔵 P3 - Low (Future)
1. **Custom Connector** - Security and validation tests

### Recommended Test Patterns for Connectors

Based on existing connector code structure, follow these patterns:

#### 1. Connector Class Tests
```typescript
describe('AirtableConnector', () => {
  describe('testConnection', () => {
    it('should successfully connect with valid API key', async () => {
      // Test successful connection
    });

    it('should throw error with invalid API key', async () => {
      // Test auth failure
    });
  });

  describe('listTables', () => {
    it('should return all tables from all bases', async () => {
      // Test table listing
    });
  });

  describe('fetchTableSpec', () => {
    it('should return table schema', async () => {
      // Test schema fetching
    });
  });
});
```

#### 2. API Client Tests
```typescript
describe('AirtableApiClient', () => {
  it('should handle rate limiting', async () => {
    // Test rate limit handling
  });

  it('should retry on transient errors', async () => {
    // Test retry logic
  });
});
```

#### 3. Schema Parser Tests
```typescript
describe('AirtableSchemaParser', () => {
  it('should convert Airtable field types to Postgres types', () => {
    // Test type conversions
  });

  it('should handle unknown field types gracefully', () => {
    // Test error handling
  });
});
```

### Next Steps for Connector Testing

1. **Complete Notion connector tests** - Add tests for connector class, schema parser
2. **Add Airtable connector tests** - Full test suite for all components
3. **Add core connector infrastructure tests** - Base class and service
4. **Add integration tests** - Test actual API calls with mocked responses
5. **Add error handling tests** - Ensure all connectors handle errors gracefully

---

## Priority Areas for Improvement

### 🔴 P0 - Critical (Must Fix Immediately)

These areas pose security, financial, or data integrity risks:

| Area                               | Files | Status       | Notes                                                                          |
| ---------------------------------- | ----- | ------------ | ------------------------------------------------------------------------------ |
| **Authentication & Authorization** | 8     | ✅ Good      | All Passport strategies, permissions, type conversions, JWT generation tested  |
| **Payment/Stripe Integration**     | 7     | ✅ Good      | Helper functions, plans, and core Stripe service fully tested                  |
| **Snapshot Core Operations**       | 30    | ❌ No tests  | Main feature; CRUD, AI integration, WebSocket events                           |
| **Database Layer**                 | 3     | ❌ No tests  | Data integrity; migrations, queries, transactions                              |
| **User Management**                | 12    | ⚠️ Improving | Token utilities and type conversions tested; services, controllers untested    |

**Risk Level**: Production bugs could compromise security, lose revenue, or corrupt user data.

---

### 🟡 P1 - High (Should Fix Soon)

These areas handle critical functionality:

| Area                         | Files | Status      | Notes                               |
| ---------------------------- | ----- | ----------- | ----------------------------------- |
| **Worker/Background Jobs**   | 12    | ❌ No tests | BullMQ processing, async operations |
| **File Upload Handling**     | 8     | ❌ No tests | S3 integration, file processing     |
| **OAuth Providers**          | 6     | ❌ No tests | Third-party auth flows              |
| **API Controllers**          | 21    | ❌ No tests | HTTP endpoints, request validation  |
| **Custom Connector Builder** | 8     | ❌ No tests | User-generated connector logic      |

**Risk Level**: Bugs could break key workflows and user experiences.

---

### 🟢 P2 - Medium (Nice to Have)

Important for long-term maintainability:

| Area                        | Files | Status       | Notes                                                                                                   |
| --------------------------- | ----- | ------------ | ------------------------------------------------------------------------------------------------------- |
| **Client React Components** | 235   | ❌ No tests  | React components and pages untested                                                                     |
| **Client Utilities**        | ~20   | ⚠️ Partial   | Helper functions tested, hooks and API layer untested                                                   |
| **Python AI Agent**         | 69    | ❌ No tests  | LLM integration, connector generation                                                                   |
| **Data Connectors**         | ~100  | ⚠️ Partial   | Notion/Wix tested, but Webflow, WordPress, YouTube, Airtable, CSV untested                              |
| **Server Utilities**        | 8     | ✅ Excellent | Duration, URL validation, asserts, encryption, HTML minification, ID utilities, enum helpers all tested |
| **Error Handling**          | N/A   | ❌ No tests  | Exception handling, logging                                                                             |

**Risk Level**: Bugs may surface during feature changes or edge cases.

---

### 🔵 P3 - Low (Future Enhancement)

Valuable for comprehensive quality assurance:

| Area                        | Status      | Notes                              |
| --------------------------- | ----------- | ---------------------------------- |
| **E2E User Workflows**      | ❌ Minimal  | Only 1 placeholder E2E test exists |
| **Integration Tests**       | ❌ No tests | No cross-service testing           |
| **Performance Tests**       | ❌ No tests | Load, stress testing               |
| **Visual Regression Tests** | ❌ No tests | UI screenshot comparison           |

---

## Testing Infrastructure

### Current Setup

**Server (Jest + ts-jest)**

- Config: `server/package.json` (lines 124-140)
- Pattern: `*.spec.ts`
- E2E config: `server/test/jest-e2e.json`
- CI: GitLab pipeline runs `yarn test`

**Client (Jest + Testing Library)**

- ✅ Framework configured: `client/jest.config.ts`
- ✅ Test scripts: `yarn test`, `yarn test:watch`, `yarn test:coverage`
- ✅ Testing Library with jsdom environment
- Pattern: `**/__tests__/**/*.test.ts` and `*.spec.ts`
- Current coverage: Utilities only (~0.4%)

**Python Agent**

- ❌ No framework configured
- Only manual test scripts exist

### Recommended Setup

**Python Agent**:

```bash
pip install pytest pytest-asyncio pytest-cov
```

---

## Progress Tracking

### Milestones

- [ ] **Milestone 1**: P0 Critical areas at 80%+ coverage

  - [ ] Authentication & Authorization
  - [ ] Payment/Stripe Integration
  - [ ] Snapshot Core Operations
  - [ ] Database Layer
  - [ ] User Management

- [ ] **Milestone 2**: P1 High priority at 70%+ coverage

  - [ ] Worker/Background Jobs
  - [ ] File Upload Handling
  - [ ] OAuth Providers
  - [ ] API Controllers
  - [ ] Custom Connector Builder

- [ ] **Milestone 3**: Server overall at 50%+ coverage

- [ ] **Milestone 4**: Client testing framework + 30%+ coverage

  - [x] Set up Jest + Testing Library
  - [x] Add utility helper tests
  - [ ] Add React component tests
  - [ ] Add hook tests
  - [ ] Add API client tests

- [ ] **Milestone 5**: Python agent at 60%+ coverage

- [ ] **Milestone 6**: Server overall at 80%+ coverage

- [ ] **Milestone 7**: E2E test suite for critical workflows

---

## Recommended Next Steps

### Immediate Actions (This Week)

1. Add unit tests for auth guards and strategies
2. Add tests for Stripe webhook handling
3. Add integration tests for snapshot CRUD operations
4. Set up coverage reporting in CI/CD

### Short-term (This Month)

1. Achieve 50%+ coverage on P0 areas
2. Add tests for client React hooks (SWR data fetching)
3. Add tests for client API layer (`client/src/lib/api/`)
4. Implement database integration tests
5. Add E2E tests for 5 critical user workflows

### Long-term (This Quarter)

1. ~~Set up client testing framework~~ ✅ **COMPLETED**
2. Add tests for client React components (Mantine UI)
3. Add pytest to Python agent
4. Achieve 80%+ coverage on server
5. Implement coverage gates in CI (fail below 70%)
6. Require tests for all new PRs

---

## Testing Best Practices

Based on the high-quality existing tests, follow these patterns:

### 1. Test Organization

```typescript
describe("FeatureName", () => {
  describe("methodName", () => {
    it("should handle normal case", () => {
      /* ... */
    });
    it("should handle edge case", () => {
      /* ... */
    });
    it("should throw error when invalid", () => {
      /* ... */
    });
  });
});
```

### 2. Use Snapshot Testing

Good for complex data structures (see Notion tests):

```typescript
expect(result).toMatchSnapshot();
```

### 3. Test Edge Cases

- Empty inputs
- Null/undefined values
- Boundary conditions
- Error scenarios

### 4. Mock External Dependencies

```typescript
jest.mock("./external-service");
```

### 5. Use Custom Matchers

See `wix/rich-content/rich-content.spec.ts` for examples.

---

## Coverage Goals

| Timeframe | Target | Current | Progress      |
| --------- | ------ | ------- | ------------- |
| Now       | <1%    | <1%     | ▓░░░░░░░░░ 1% |
| 1 Month   | 30%    | <1%     | ░░░░░░░░░░ 0% |
| 3 Months  | 60%    | <1%     | ░░░░░░░░░░ 0% |
| 6 Months  | 80%    | <1%     | ░░░░░░░░░░ 0% |

---

## Notes & Observations

- **Quality over Quantity**: Existing tests are excellent. Maintain this standard.
- **Follow Existing Patterns**: Use Notion conversion tests as reference.
- **CI Integration**: Tests run automatically on MRs - leverage this.
- **Critical Gap**: Security & payment code must be tested ASAP.
- **Low Hanging Fruit**: Start with utility functions and services before complex controllers.

---

## Resources

- Server test config: `server/package.json`
- E2E test config: `server/test/jest-e2e.json`
- Example tests: `server/src/remote-service/connectors/library/notion/conversion/__tests__/`
- CI pipeline: `.gitlab-ci.yml`

---

## Recent Changes

### 2025-11-13 (Early Morning)

- ✅ **Stripe Payment Service tests added** (+1 test file, +28 test cases)
  - Stripe payment service tests (`server/src/payment/stripe-payment.service.spec.ts`) - 28 test cases
    - Customer ID generation with Stripe API integration
    - Trial subscription creation (7-day trial period, payment method collection)
    - Checkout URL generation for new subscriptions
    - Customer portal URL creation for existing subscriptions
    - Active subscription validation and ownership checks
    - Webhook callback handling with signature verification
    - Checkout session completed webhook processing
    - Subscription update/delete webhook processing
    - Invoice paid/failed webhook processing
    - Subscription upsert logic (create and update operations)
    - Scratchpad subscription identification by metadata and price ID
    - User lookup from Stripe customer ID
    - Organization validation for subscriptions
    - Database error handling for upsert operations
    - Edge cases (unknown product types, missing URLs, non-scratchpad subscriptions)
- 📊 **Coverage updated**: Server went from ~7.8% to ~8.3%, overall from ~4.2% to ~4.4%
- 🎯 **Progress**: P0 critical area (Payment/Stripe Integration) status improved from "Improving" to "Good"
- 💰 **Financial impact**: Comprehensive testing of all Stripe payment workflows reduces risk of billing errors
- 📈 **Cumulative progress**: 424 new test cases across 20 test files in last 3 days
- 🎉 **Milestone**: Payment/Stripe Integration is now the second P0 critical area to reach "Good" status!

- ✅ **Webflow connector tests added** (+1 test file, +9 test cases)
  - Webflow connector tests (`server/src/remote-service/connectors/library/webflow/webflow-connector.spec.ts`) - 9 test cases
    - `downloadTableRecords` function - Core record download and transformation logic
    - Pagination handling with pagination metadata
    - Rich text conversion (HTML to Markdown with Turndown service)
    - Rich text HTML mode when dataConverter is 'html'
    - Metadata columns handling (isDraft, isArchived, lastPublished, lastUpdated, createdOn)
    - Helper methods (displayName, getBatchSize, service type)
  - **Mock implementation**: Successfully mocked WebflowClient API for testing
  - **Format validation**: Tests ensure correct transformation from Webflow API format to ConnectorRecord format
- 📊 **Coverage updated**: Connector tests went from 5 to 6 test files, test cases from ~152 to ~161
- 🎯 **Progress**: Webflow connector moved from "No tests" to "Partial Coverage" (30% coverage)
- 🔌 **Connector impact**: Core downloadTableRecords functionality tested with proper API mocking
- 📈 **Cumulative progress**: 9 new test cases for Webflow connector

### 2025-11-12 (Post-Midnight - Round 4)

- ✅ **Passport authentication strategy tests added** (+3 test files, +42 test cases)
  - API Token Strategy tests (`server/src/auth/api-token.strategy.spec.ts`) - 11 test cases
    - Valid API token validation and user lookup
    - Multiple API tokens per user handling
    - Invalid token rejection and null returns
    - Edge cases (empty token array, mismatched tokens, expired tokens)
    - Database error handling
    - Special characters and long tokens
    - User field preservation in authenticated response
  - Agent Token Strategy tests (`server/src/auth/agent-token.strategy.spec.ts`) - 15 test cases
    - Agent token format validation (key:userId colon-separated format)
    - Invalid agent key rejection
    - User lookup by ID
    - Token format edge cases (no colon, multiple colons, empty parts, whitespace)
    - User without organization ID handling
    - Database error handling
    - Special characters and long user IDs
    - Auth type and source validation (agent-token, agent)
  - Clerk JWT Strategy tests (`server/src/auth/clerk.strategy.spec.ts`) - 16 test cases
    - Bearer token extraction from Authorization header
    - JWT verification with Clerk using verifyToken
    - User creation/retrieval from Clerk payload (sub, fullName, primaryEmail)
    - Missing/malformed authorization header handling
    - Token verification error handling (TokenVerificationError, generic errors)
    - Database error handling during user lookup
    - Missing user handling
    - Optional JWT fields (fullName, primaryEmail can be undefined)
    - Case-sensitive Bearer prefix validation
    - Long tokens and special characters in user data
- 📊 **Coverage updated**: Server went from ~7.3% to ~7.8%, overall from ~4.0% to ~4.2%
- 🎯 **Progress**: P0 critical area (Authentication & Authorization) status improved from "Improving" to "Good" - all Passport strategies now fully tested
- 🔒 **Security impact**: All three authentication strategies (Clerk JWT, API Token, Agent Token) are now comprehensively tested - critical for security
- 📈 **Cumulative progress**: 396 new test cases across 19 test files in last 2 days
- 🎉 **Milestone**: Authentication & Authorization is now the first P0 critical area to reach "Good" status!

### 2025-11-12 (Very Late Night - Round 3)

- ✅ **Agent JWT generation tests added** (+1 test file, +11 test cases)
  - JWT generator service tests (`server/src/agent-jwt/jwt-generator.service.spec.ts`) - 11 test cases
    - Token generation with valid user and admin role payloads
    - Config service integration for secret and expiration retrieval
    - Custom config value verification in token signing
    - Special character and long user ID edge cases
    - Token uniqueness validation
    - JWT service integration verification
- 📊 **Coverage updated**: Server went from ~7.0% to ~7.3%, overall from ~3.9% to ~4.0%
- 🎯 **Progress**: P0 critical areas (Authentication) improved with JWT generation now fully tested
- 🔒 **Security impact**: Agent JWT generation is a foundational security component for agent authentication
- 📈 **Cumulative progress**: 354 new test cases across 16 test files in last 2 days

### 2025-11-12 (Late Night - Round 2)

- ✅ **Auth and user management tests added** (+3 test files, +33 test cases)
  - User token utilities (`server/src/users/tokens.spec.ts`) - 13 test cases
    - API token generation with nanoid (32 characters, URL-safe)
    - Token uniqueness validation
    - API token expiration date (6 months)
    - WebSocket token expiration date (1 day)
  - Auth type conversion (`server/src/auth/types.spec.ts`) - 10 test cases
    - toActor conversion for all auth types (jwt, api-token, agent-token)
    - Auth source handling (user vs agent)
    - Organization ID fallback for null/undefined values
    - Edge case handling
  - User type conversion (`server/src/users/types.spec.ts`) - 10 test cases
    - userToActor conversion with complete user data
    - Organization ID fallback handling
    - Actor object field validation (only userId and organizationId)
    - Metadata exclusion verification
- 🛠️ **Jest configuration improved**
  - Added transformIgnorePatterns to handle nanoid ES module
- 📊 **Coverage updated**: Server went from ~6.5% to ~7.0%, overall from ~3.7% to ~3.9%
- 🎯 **Progress**: P0 critical areas (Authentication & User Management) status improved from "Minimal/No tests" to "Improving"
- 🔒 **Security impact**: Token generation and user/auth conversions are foundational security utilities now tested
- 📈 **Cumulative progress**: 343 new test cases across 15 test files in last 2 days

### 2025-11-12 (After Midnight)

- ✅ **Payment plans tests added** (+1 test file, +20 test cases)
  - Payment plans tests (`server/src/payment/plans.spec.ts`) - 20 test cases
    - Plan type string conversion (getPlanTypeFromString)
    - Environment-specific plan retrieval for production, staging, test, and local
    - Plan lookup by product type
    - Plan structure validation (required fields)
    - Unique Stripe product ID and price ID validation across environments
    - Display name consistency validation
    - Enum completeness checks
- 🛠️ **Jest configuration improved**
  - Added moduleNameMapper to support `src/` import aliases in tests
  - Enables testing of files that use absolute imports from `src/`
- 📊 **Coverage updated**: Server went from ~6.3% to ~6.5%, overall from ~3.6% to ~3.7%
- 🎯 **Progress**: Payment area status improved from "Minimal" to "Improving" with plans module now fully tested
- 💰 **Financial impact**: Plan configuration is critical for billing - these tests ensure correct Stripe IDs across environments
- 📈 **Cumulative progress**: 310 new test cases across 13 test files in last 2 days

### 2025-11-12 (Late Night)

- ✅ **Auth permissions tests added** (+1 test file, +16 test cases)
  - Permission utility tests (`server/src/auth/permissions.spec.ts`) - 16 test cases
    - Admin role permission checks with jwt, api-token, and agent-token auth types
    - User role permission denials across all auth types
    - Edge case handling (missing organization id, clerk id, name/email)
    - Comprehensive testing of all role + auth type combinations
    - Auth source variation testing (user vs agent)
- 📊 **Coverage updated**: Server went from ~6.2% to ~6.3%, overall from ~3.5% to ~3.6%
- 🎯 **Progress**: First P0 auth tests added - critical security permission logic now tested
- 🔒 **Security impact**: hasAdminToolsPermission is used to gate admin-only endpoints
- 📈 **Cumulative progress**: 290 new test cases across 12 test files in last 2 days

### 2025-11-12 (Night)

- ✅ **Encryption utility tests added** (+1 test file, +35 test cases)
  - Encryption utility tests (`server/src/utils/encryption.spec.ts`) - 35 test cases
    - Constructor validation for master key requirements
    - String encryption/decryption with AES-256-GCM
    - Object encryption/decryption with JSON serialization
    - Round-trip testing for various data types (strings, Unicode, special chars, JSON)
    - Security properties verification (IV/salt randomness, correct lengths)
    - Error handling (tampered data, wrong IV/salt, different master keys)
    - Edge cases (empty inputs, long strings, nested objects)
- 📊 **Coverage updated**: Server went from ~5.8% to ~6.2%, overall from ~3.3% to ~3.5%
- 🎯 **Progress**: Critical security utility (encryption) now has comprehensive test coverage - addressing P0 security testing gap
- 🔒 **Security impact**: Encryption is used for storing connector credentials, so this testing is critical for data security
- 📈 **Cumulative progress**: 274 new test cases across 11 test files in last 2 days

### 2025-11-12 (Late Evening)

- ✅ **Snapshot utilities and CSV parser tests added** (+2 test files, +31 test cases)
  - Snapshot utilities tests (`server/src/snapshot/util.spec.ts`) - 9 test cases
    - Finding snapshot tables by workspace ID (wsId)
    - Finding table specs by workspace ID
    - Handling missing tables, empty snapshots, and multiple table scenarios
  - CSV parser tests (`server/src/remote-service/connectors/library/csv/csv-parser.spec.ts`) - 22 test cases
    - Basic CSV parsing with headers and rows
    - Quoted fields with commas and escaped quotes
    - Empty fields, Unicode, and special characters
    - Row ID generation and field handling
    - Real-world CSV formatting scenarios
- 📊 **Coverage updated**: Server went from ~5.0% to ~5.8%, overall from ~2.9% to ~3.3%
- 🎯 **Progress**: Snapshot core utilities and CSV connector now have comprehensive test coverage
- 📈 **Cumulative progress**: 239 new test cases across 10 test files in last 2 days

### 2025-11-12 (Evening)

- ✅ **Slack formatter tests added** (+1 test file, +19 test cases)
  - Slack formatters tests (`server/src/slack/slack-formatters.spec.ts`) - 19 test cases
    - Link formatting in Slack markdown format
    - Special characters and Unicode handling in labels
    - Query parameters, fragments, and URL edge cases
    - New user signup message formatting
    - Offer code handling with various scenarios
    - Fallback handling for missing user data (email/name)
- 📊 **Coverage updated**: Server went from ~4.6% to ~5.0%, overall from ~2.7% to ~2.9%
- 🎯 **Progress**: Slack notification utilities now have comprehensive test coverage
- 📈 **Cumulative progress**: 208 new test cases across 8 test files in last 2 days

### 2025-11-12 (Afternoon)

- ✅ **Server Result type utility tests added** (+1 test file, +68 test cases)
  - Result type tests (`server/src/types/results.spec.ts`) - 68 test cases
    - Success and error result creation
    - Type guard functions (isOk, isErr, isResult, isAllOk)
    - Array operations (coalesceResultArray, partitionResultArray)
    - Value extraction and conversion utilities
    - All 17 error helper functions with different error codes
    - Error metadata handling (cause, context, isRetriable)
- 📊 **Coverage updated**: Server went from ~4.2% to ~4.6%, overall from ~2.5% to ~2.7%
- 🎯 **Progress**: Core Result type now has comprehensive test coverage
- 📈 **Cumulative progress**: 189 new test cases across 7 test files in last 2 days

### 2025-11-11 (Evening)

- ✅ **Additional server utility tests added** (+3 test files, +64 test cases)
  - Duration utility tests (`server/src/utils/duration.spec.ts`) - 31 test cases
    - Factory functions (milliseconds, seconds, minutes, hours, days)
    - Duration conversions and calculations
    - Date manipulation methods (before, after, inPast, inFuture)
    - Human-readable formatting with proper units
    - Edge cases (zero, negative, fractional values)
  - URL validation tests (`server/src/utils/urls.spec.ts`) - 26 test cases
    - Valid URL patterns (HTTP/HTTPS, domains, subdomains, TLDs)
    - Query strings, fragments, ports, and paths
    - IP address validation
    - Edge cases and invalid URL patterns
  - Assert utility tests (`server/src/utils/asserts.spec.ts`) - 7 test cases
    - Exhaustive type checking with assertUnreachable
    - Error message formatting for different value types
    - Usage in switch statement exhaustiveness checking
- 📊 **Coverage updated**: Server went from ~3.5% to ~4.2%, overall from ~2% to ~2.5%
- 🎯 **Progress**: Server utilities now have excellent coverage (6 utility files fully tested)
- 🎉 **Total new tests today**: 121 test cases across 6 test files

### 2025-11-11 (Morning)

- ✅ **Server utility tests added** (+3 test files)
  - Payment helper tests (`server/src/payment/helpers.spec.ts`) - 13 test cases
    - Active subscription filtering
    - Latest expiring subscription detection
    - Subscription ownership validation
  - ID utility tests (`server/src/types/ids.spec.ts`) - 20+ test cases
    - ID generation with typed prefixes
    - ID validation and type checking
    - Type inference from ID strings
  - String/enum helper tests (`server/src/utils/helpers.spec.ts`) - 12 test cases
    - String-to-enum conversion with case matching
    - Default value handling
- 📊 **Coverage updated**: Server went from ~2.3% to ~3.5%, overall from ~1.2% to ~2%
- 🎯 **Progress**: 57 new test cases added across utility and helper functions

### 2025-11-10

- ✅ **Client testing framework setup complete**
  - Added Jest with Next.js integration (`jest.config.ts`)
  - Configured Testing Library for React (`jest.setup.ts`)
  - Added test scripts to `package.json`: `test`, `test:watch`, `test:coverage`
  - Dependencies installed: `@testing-library/react@16.3.0`, `@testing-library/jest-dom@6.9.1`, `jest@30.2.0`
- ✅ **First client tests written**
  - Comprehensive utility helper tests (`client/src/utils/__tests__/helpers.test.ts`)
  - 14 functions covered with ~200 lines of tests
  - Includes edge cases and error scenarios
- 📊 **Coverage updated**: Client went from 0% to ~0.4%, overall from <1% to ~1.2%

---

**Instructions**: Update this file as you add tests. Track your progress in the "Progress Tracking" section and update the coverage percentages monthly.
