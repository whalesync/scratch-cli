# Connector Test Pattern Guide

This guide shows how to write consistent, minimal tests for connectors.

## Quick Start Pattern

All connector tests should follow this structure:

```typescript
import { Service } from '@prisma/client';
import { PostgresColumnType } from '../../types';
import { YourTableSpec } from '../custom-spec-registry';

// 1. DEFINE MOCK CLIENT TYPE
type MockYourClient = {
  // Only mock the methods your connector actually calls
  getData: jest.Mock;
  postData: jest.Mock;
};

// 2. CREATE MOCK CLIENT FACTORY
const createMockClient = (): MockYourClient => ({
  getData: jest.fn(),
  postData: jest.fn(),
});

// 3. SET UP MODULE-LEVEL MOCKING (before imports!)
const mockClientWrapper = {
  client: createMockClient(),
};

jest.mock('your-api-library', () => ({
  YourApiClient: jest.fn(() => mockClientWrapper.client),
}));

// 4. IMPORT YOUR CONNECTOR AFTER MOCKS
import { YourConnector } from './your-connector';

// 5. WRITE TESTS
describe('YourConnector', () => {
  let connector: YourConnector;
  let mockClient: MockYourClient;

  beforeEach(() => {
    // Create fresh mock client for each test
    mockClientWrapper.client = createMockClient();
    mockClient = mockClientWrapper.client;
    connector = new YourConnector('test-credentials');
  });

  describe('downloadTableRecords', () => {
    const mockTableSpec: YourTableSpec = {
      // MINIMAL spec with 1-2 fields only
      id: { wsId: 'table1', remoteId: ['table123'] },
      name: 'Test Table',
      columns: [
        {
          id: { wsId: 'name', remoteId: ['name'] },
          name: 'Name',
          pgType: PostgresColumnType.TEXT,
          // Add connector-specific field type properties
        },
      ],
    };

    it('should download records and transform basic fields', async () => {
      // Mock API response with MINIMAL data (2-3 records max)
      mockClient.getData.mockResolvedValue({
        items: [
          { id: 'item1', name: 'Test 1' },
          { id: 'item2', name: 'Test 2' },
        ],
      });

      const callback = jest.fn().mockResolvedValue(undefined);

      await connector.downloadTableRecords(mockTableSpec, {}, callback);

      expect(callback).toHaveBeenCalledTimes(1);
      const records = (callback.mock.calls[0][0] as { records: ConnectorRecord[] }).records;
      expect(records).toHaveLength(2);
      expect(records[0].id).toBe('item1');
      expect(records[0].fields.name).toBe('Test 1');
    });

    it('should handle pagination correctly', async () => {
      // Set up multi-page response
      mockClient.getData
        .mockResolvedValueOnce({
          items: Array.from({ length: 100 }, (_, i) => ({ id: `item${i}`, name: `Item ${i}` })),
          hasMore: true,
        })
        .mockResolvedValueOnce({
          items: Array.from({ length: 50 }, (_, i) => ({ id: `item${i + 100}`, name: `Item ${i + 100}` })),
          hasMore: false,
        });

      const callback = jest.fn().mockResolvedValue(undefined);

      await connector.downloadTableRecords(mockTableSpec, {}, callback);

      expect(mockClient.getData).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledTimes(2);

      const firstBatch = (callback.mock.calls[0][0] as { records: ConnectorRecord[] }).records;
      const secondBatch = (callback.mock.calls[1][0] as { records: ConnectorRecord[] }).records;
      expect(firstBatch).toHaveLength(100);
      expect(secondBatch).toHaveLength(50);
    });
  });

  describe('displayName', () => {
    it('should return YourService as display name', () => {
      expect(connector.displayName()).toBe('YourService');
    });
  });

  describe('service', () => {
    it('should have YOUR_SERVICE service type', () => {
      expect(connector.service).toBe(Service.YOUR_SERVICE);
    });
  });

  describe('getBatchSize', () => {
    it('should return batch size', () => {
      expect(connector.getBatchSize()).toBe(100); // or whatever your default is
    });
  });
});
```

## Why Use a Wrapper Object?

The `mockClientWrapper` pattern ensures the mock reference stays consistent:

```typescript
// This wrapper allows us to replace the client in each test
const mockClientWrapper = {
  client: createMockClient(),
};

// Jest captures this reference once
jest.mock('your-api-library', () => ({
  YourApiClient: jest.fn(() => mockClientWrapper.client),
}));

// In each test, we replace the client
beforeEach(() => {
  mockClientWrapper.client = createMockClient(); // ✅ Updates the reference Jest uses
  mockClient = mockClientWrapper.client;
});
```

Without the wrapper, reassigning the variable wouldn't work:

```typescript
// ❌ This doesn't work - Jest captured the old reference
let mockClient = createMockClient();
jest.mock('your-api-library', () => ({
  YourApiClient: jest.fn(() => mockClient), // Captured once!
}));

beforeEach(() => {
  mockClient = createMockClient(); // This doesn't update the mock
});
```

## Common Pagination Patterns

### Cursor-based (Notion, some APIs)

```typescript
it('should handle pagination correctly', async () => {
  mockClient.databases.query
    .mockResolvedValueOnce({
      results: [{ id: 'page1', properties: {...} }],
      has_more: true,
      next_cursor: 'cursor1',
    })
    .mockResolvedValueOnce({
      results: [{ id: 'page2', properties: {...} }],
      has_more: false,
      next_cursor: null,
    });

  const callback = jest.fn().mockResolvedValue(undefined);
  await connector.downloadTableRecords(mockTableSpec, {}, callback);

  expect(mockClient.databases.query).toHaveBeenCalledTimes(2);
  expect(mockClient.databases.query).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ start_cursor: 'cursor1' })
  );
});
```

### Offset-based (WordPress, traditional APIs)

```typescript
it('should handle pagination correctly', async () => {
  mockClient.fetch
    .mockResolvedValueOnce([{ id: '1' }, { id: '2' }])
    .mockResolvedValueOnce([{ id: '3' }]);

  const callback = jest.fn().mockResolvedValue(undefined);
  await connector.downloadTableRecords(mockTableSpec, {}, callback);

  expect(mockClient.fetch).toHaveBeenCalledTimes(2);
  expect(mockClient.fetch).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ offset: 2 })
  );
});
```

### Metadata-based (Webflow)

```typescript
it('should handle pagination correctly', async () => {
  mockClient.collections.items.listItems
    .mockResolvedValueOnce({
      items: Array.from({ length: 100 }, (_, i) => ({ id: `item${i}`, fieldData: {} })),
      pagination: { total: 150, offset: 0, limit: 100 },
    })
    .mockResolvedValueOnce({
      items: Array.from({ length: 50 }, (_, i) => ({ id: `item${i + 100}`, fieldData: {} })),
      pagination: { total: 150, offset: 100, limit: 100 },
    });

  const callback = jest.fn().mockResolvedValue(undefined);
  await connector.downloadTableRecords(mockTableSpec, {}, callback);

  expect(mockClient.collections.items.listItems).toHaveBeenCalledTimes(2);
  expect(mockClient.collections.items.listItems).toHaveBeenNthCalledWith(
    1,
    'collection456',
    { offset: 0, limit: 100 }
  );
  expect(mockClient.collections.items.listItems).toHaveBeenNthCalledWith(
    2,
    'collection456',
    { offset: 100, limit: 100 }
  );
});
```

## Key Principles

### 1. Mock the API Client, Not the Internals
- Mock the SDK/API client that your connector uses
- Don't test the HTTP client itself - assume it works
- Only mock methods your connector actually calls

```typescript
// ✅ GOOD: Mock the SDK/API client
jest.mock('webflow-api', () => ({
  WebflowClient: jest.fn(() => mockClientWrapper.client),
}));

// ❌ BAD: Mock HTTP internals
jest.mock('https');
```

### 2. Use Minimal Data
- **1-2 field types max** in table specs
- **2-3 records max** in basic test data
- Use `Array.from()` for pagination tests (100 items per page is fine)
- Avoid complex nested structures

```typescript
// ✅ GOOD: Minimal data
const mockData = [
  { id: 'item1', name: 'Test 1' },
  { id: 'item2', name: 'Test 2' },
];

// ❌ BAD: Too much data
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

### 4. Required Test Coverage

Every connector test file MUST include:
1. `downloadTableRecords` - basic download test
2. `downloadTableRecords` - pagination test
3. `displayName` test
4. `service` test
5. `getBatchSize` test

Additional tests based on connector features:
- Rich text conversion (HTML ↔ Markdown)
- Metadata columns handling
- Progress/resume functionality
- Special field types

## Testing Rich Text Conversion

Many connectors need to handle rich text fields that can be returned as HTML or Markdown:

```typescript
it('should convert rich text to markdown by default', async () => {
  mockClient.getData.mockResolvedValue({
    items: [
      { id: '1', description: '<h1>Heading</h1><p>Text</p>' }
    ],
  });

  const callback = jest.fn().mockResolvedValue(undefined);
  await connector.downloadTableRecords(spec, {}, callback);

  const record = (callback.mock.calls[0][0] as { records: ConnectorRecord[] }).records[0];
  expect(record.fields.description).toBe('# Heading\n\nText');
});

it('should keep rich text as HTML when dataConverter is html', async () => {
  const columnSettings = {
    'description-field': { dataConverter: 'html' }
  };

  mockClient.getData.mockResolvedValue({
    items: [
      { id: '1', description: '<h1>Heading</h1>' }
    ],
  });

  const callback = jest.fn().mockResolvedValue(undefined);
  await connector.downloadTableRecords(spec, columnSettings, callback);

  const record = (callback.mock.calls[0][0] as { records: ConnectorRecord[] }).records[0];
  expect(record.fields.description).toBe('<h1>Heading</h1>');
});
```

## Real-World Examples

### Complete Example: Notion Connector

See `notion/notion-connector.spec.ts` for a complete working example:
- Cursor-based pagination
- Module-level mocking with wrapper
- Minimal table spec (1 field)
- Basic download test
- Pagination test

### Complete Example: Webflow Connector

See `webflow/webflow-connector.spec.ts` for a complete working example:
- Metadata-based pagination
- Module-level mocking with wrapper
- Minimal table spec (1 field)
- Rich text conversion tests
- Metadata column tests

## Troubleshooting

### "Mock was not called" or tests timing out

Make sure your mock is set up **before** importing the connector:

```typescript
// ✅ GOOD - mock before import
jest.mock('your-api-library', () => ({...}));
import { YourConnector } from './your-connector';

// ❌ BAD - import before mock
import { YourConnector } from './your-connector';
jest.mock('your-api-library', () => ({...}));
```

### Mock returns undefined

Check that you're using the wrapper pattern correctly:

```typescript
// ✅ GOOD - wrapper pattern
const mockClientWrapper = { client: createMockClient() };
jest.mock('library', () => ({ Client: jest.fn(() => mockClientWrapper.client) }));

beforeEach(() => {
  mockClientWrapper.client = createMockClient(); // Update the wrapper
  mockClient = mockClientWrapper.client;
});

// ❌ BAD - direct reassignment
let mockClient = createMockClient();
jest.mock('library', () => ({ Client: jest.fn(() => mockClient) }));

beforeEach(() => {
  mockClient = createMockClient(); // Doesn't update the mock!
});
```

### TypeScript errors with mock types

Make sure your mock type uses `jest.Mock`:

```typescript
// ✅ GOOD
type MockClient = {
  getData: jest.Mock;
};

// ❌ BAD
type MockClient = {
  getData: Function;
};
```
