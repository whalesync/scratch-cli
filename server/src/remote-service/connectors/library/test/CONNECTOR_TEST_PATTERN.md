# Connector Test Pattern

This document describes the standardized pattern for testing connectors.

## Overview

All connector tests should follow a consistent structure to ensure:
- **Completeness**: All critical methods are tested
- **Maintainability**: Tests are easy to understand and update
- **Efficiency**: Tests use minimal data to avoid memory issues
- **Consistency**: All connectors are tested the same way

## Required Tests

Every connector test file MUST include tests for:

1. ✅ `downloadTableRecords` - basic download and transformation
2. ✅ `downloadTableRecords` - pagination handling
3. ✅ `displayName()` - returns correct connector name
4. ✅ `service` - has correct Service enum value
5. ✅ `getBatchSize()` - returns valid batch size

## Testing Pattern

Follow the structure in `connector-test-example.md`:

```typescript
describe('YourConnector', () => {
  let connector: YourConnector;
  let mockClient: MockClient;

  beforeEach(() => {
    // Set up mocks
  });

  describe('downloadTableRecords', () => {
    it('should download records and transform basic fields', async () => {
      // Test basic download
    });

    it('should handle pagination correctly', async () => {
      // Test pagination
    });
  });

  describe('displayName', () => {
    it('should return correct display name', () => {
      // Test display name
    });
  });

  describe('service', () => {
    it('should have correct service type', () => {
      // Test service
    });
  });

  describe('getBatchSize', () => {
    it('should return batch size', () => {
      // Test batch size
    });
  });
});
```

## Key Testing Principles

### 1. Mock the API Client, Not Internals
```typescript
// ✅ GOOD: Mock the SDK/API client
jest.mock('webflow-api', () => ({
  WebflowClient: jest.fn().mockImplementation(() => mockClient),
}));

// ❌ BAD: Mock HTTP internals or make real API calls
jest.mock('https');
```

### 2. Use Minimal Test Data
```typescript
// ✅ GOOD: 2-3 records, 1-2 fields
const mockData = [
  { id: 'item1', name: 'Test 1' },
  { id: 'item2', name: 'Test 2' },
];

// ❌ BAD: Hundreds of records, dozens of fields
const mockData = Array.from({ length: 1000 }, (_, i) => ({
  id: `item${i}`,
  field1: '...',
  field2: '...',
  // ... 20 more fields
}));
```

### 3. Test Core Logic, Not Everything
Focus on:
- ✅ Download mechanism
- ✅ Pagination logic
- ✅ Data transformation (API → ConnectorRecord)
- ✅ Connector-specific features (rich text, metadata, etc.)

Don't test:
- ❌ The API client/SDK itself
- ❌ Network layer
- ❌ Every possible field type combination

## Files

- `connector-test-helpers.ts` - Utility functions for testing
- `connector-test-example.md` - Detailed examples and patterns
- `CONNECTOR_TEST_PATTERN.md` - This file

## Examples

See these connector tests for reference:
- `webflow/webflow-connector.spec.ts` - Metadata-based pagination
- `notion/notion-connector.spec.ts` - Cursor-based pagination
- `wordpress/wordpress-connector.spec.ts` - Offset-based pagination

## Adding Tests for a New Connector

1. **Create mock client**:
   ```typescript
   const createMockClient = () => ({
     // Only methods your connector actually uses
   });
   ```

3. **Mock the API library**:
   ```typescript
   jest.mock('your-api-library', () => ({ ... }));
   ```

4. **Write required tests**:
   - Download + transform
   - Pagination
   - Metadata methods

5. **Add connector-specific tests**:
   - Rich text conversion
   - Metadata columns
   - Progress/resume
   - Special field types

6. **Keep it minimal**:
   - 1-2 fields in table specs
   - 2-3 records in test data
   - Focus on core logic

## Testing Checklist

When reviewing connector tests, verify:

- [ ] Mocks the API client (not internals)
- [ ] Uses minimal data (2-3 records, 1-2 fields)
- [ ] Tests `downloadTableRecords` basic functionality
- [ ] Tests `downloadTableRecords` pagination
- [ ] Tests `displayName()`
- [ ] Tests `service` property
- [ ] Tests `getBatchSize()`
- [ ] Includes connector-specific tests (if applicable)
- [ ] All tests pass without memory errors
- [ ] No ESLint warnings
