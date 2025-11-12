# Test Coverage Assessment & Tracking

Note: This is an AI-generated file to keep track of where we could improve tests.

**Last Updated**: 2025-11-12
**Overall Coverage**: ~3.3% (Server: ~5.8%, Client: ~0.4%, Python Agent: 0%)

---

## Executive Summary

The codebase has **critical test coverage gaps**. While existing tests demonstrate high quality, only 15 test files exist for 562+ source files across all codebases. Progress is being made with new utility and helper function tests.

### Coverage Statistics

| Codebase     | Source Files | Test Files | Coverage |
| ------------ | ------------ | ---------- | -------- |
| Server       | 258          | 16         | ~5.8%    |
| Client       | 235          | 1          | ~0.4%    |
| Python Agent | 69           | 0          | 0%       |
| **Total**    | **562**      | **17**     | **~3.3%** |

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

- ✅ **Server ID utilities** - 20+ test cases for typed ID system (`server/src/types/ids.spec.ts`)
  - ID generation with prefixes
  - ID validation and type checking
  - Type inference from ID strings

- ✅ **Server utility helpers** - 108 test cases across utility functions
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

---

## Priority Areas for Improvement

### 🔴 P0 - Critical (Must Fix Immediately)

These areas pose security, financial, or data integrity risks:

| Area                               | Files | Status         | Notes                                                        |
| ---------------------------------- | ----- | -------------- | ------------------------------------------------------------ |
| **Authentication & Authorization** | 8     | ❌ No tests    | Security-critical; includes Passport strategies, JWT, guards |
| **Payment/Stripe Integration**     | 7     | ⚠️ Minimal     | Helper functions tested; webhooks, service layer untested    |
| **Snapshot Core Operations**       | 30    | ❌ No tests    | Main feature; CRUD, AI integration, WebSocket events         |
| **Database Layer**                 | 3     | ❌ No tests    | Data integrity; migrations, queries, transactions            |
| **User Management**                | 12    | ❌ No tests    | User CRUD, profiles, permissions                             |

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

| Area                        | Files | Status       | Notes                                                                      |
| --------------------------- | ----- | ------------ | -------------------------------------------------------------------------- |
| **Client React Components** | 235   | ❌ No tests  | React components and pages untested                                        |
| **Client Utilities**        | ~20   | ⚠️ Partial   | Helper functions tested, hooks and API layer untested                      |
| **Python AI Agent**         | 69    | ❌ No tests  | LLM integration, connector generation                                      |
| **Data Connectors**         | ~100  | ⚠️ Partial   | Notion/Wix tested, but Webflow, WordPress, YouTube, Airtable, CSV untested |
| **Server Utilities**        | 7     | ✅ Excellent | Duration, URL validation, asserts, HTML minification, ID utilities, enum helpers all tested |
| **Error Handling**          | N/A   | ❌ No tests  | Exception handling, logging                                                |

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
