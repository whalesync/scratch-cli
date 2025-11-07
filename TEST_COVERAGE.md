# Test Coverage Assessment & Tracking

Note: This is an AI-generated file to keep track of where we could improve tests.

**Last Updated**: 2025-11-06
**Overall Coverage**: <1% (Server: ~2.3%, Client: 0%, Python Agent: 0%)

---

## Executive Summary

The codebase has **critical test coverage gaps**. While existing tests demonstrate high quality, only 6 test files exist for 562+ source files across all codebases. Security-critical and revenue-generating features have zero test coverage.

### Coverage Statistics

| Codebase     | Source Files | Test Files | Coverage |
| ------------ | ------------ | ---------- | -------- |
| Server       | 258          | 6          | ~2.3%    |
| Client       | 235          | 0          | 0%       |
| Python Agent | 69           | 0          | 0%       |
| **Total**    | **562**      | **6**      | **<1%**  |

---

## Currently Tested Areas (High Quality ✅)

These areas have excellent test coverage and should serve as models:

- ✅ **Notion rich text conversion** - 1,500+ lines of tests (`server/src/remote-service/connectors/library/notion/conversion/__tests__/`)

  - Block diffing algorithm
  - Batch operations
  - Round-trip conversions

- ✅ **Wix rich content conversion** - Comprehensive converter tests (`server/src/remote-service/connectors/library/wix/rich-content/rich-content.spec.ts`)

- ✅ **HTML minification** - 70+ test cases (`server/src/wrappers/html-minify.spec.ts`)

---

## Priority Areas for Improvement

### 🔴 P0 - Critical (Must Fix Immediately)

These areas pose security, financial, or data integrity risks:

| Area                               | Files | Status      | Notes                                                        |
| ---------------------------------- | ----- | ----------- | ------------------------------------------------------------ |
| **Authentication & Authorization** | 8     | ❌ No tests | Security-critical; includes Passport strategies, JWT, guards |
| **Payment/Stripe Integration**     | 7     | ❌ No tests | Revenue-critical; billing, subscriptions, webhooks           |
| **Snapshot Core Operations**       | 30    | ❌ No tests | Main feature; CRUD, AI integration, WebSocket events         |
| **Database Layer**                 | 3     | ❌ No tests | Data integrity; migrations, queries, transactions            |
| **User Management**                | 12    | ❌ No tests | User CRUD, profiles, permissions                             |

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

| Area                        | Files | Status      | Notes                                                                      |
| --------------------------- | ----- | ----------- | -------------------------------------------------------------------------- |
| **Client React Components** | 235   | ❌ No tests | Entire frontend untested                                                   |
| **Python AI Agent**         | 69    | ❌ No tests | LLM integration, connector generation                                      |
| **Data Connectors**         | ~100  | ⚠️ Partial  | Notion/Wix tested, but Webflow, WordPress, YouTube, Airtable, CSV untested |
| **Utilities & Helpers**     | 7     | ❌ No tests | Shared functions                                                           |
| **Error Handling**          | N/A   | ❌ No tests | Exception handling, logging                                                |

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

**Client**

- ❌ No framework configured
- ❌ No test scripts

**Python Agent**

- ❌ No framework configured
- Only manual test scripts exist

### Recommended Setup

**Client**:

```json
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "vitest": "^1.0.0"
  }
}
```

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
2. Add tests for all API controllers
3. Implement database integration tests
4. Add E2E tests for 5 critical user workflows

### Long-term (This Quarter)

1. Set up client testing framework (Vitest + Testing Library)
2. Add pytest to Python agent
3. Achieve 80%+ coverage on server
4. Implement coverage gates in CI (fail below 70%)
5. Require tests for all new PRs

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

**Instructions**: Update this file as you add tests. Track your progress in the "Progress Tracking" section and update the coverage percentages monthly.
