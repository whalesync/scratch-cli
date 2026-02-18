# Table Discovery Mode API

## Context

Connectors like Notion have slow APIs that can't efficiently list all tables. We need a "search" discovery mode where the user searches for specific tables instead of browsing a flat list. This change adds the plumbing for both modes without switching any connectors — all default to LIST.

## Changes

### 1. Add `TableDiscoveryMode` enum

**File:** `packages/shared-types/src/enums/enums.ts`

```typescript
export enum TableDiscoveryMode {
  LIST = "LIST",
  SEARCH = "SEARCH",
}
```

### 2. Add discovery mode + searchTables to Connector base class

**File:** `server/src/remote-service/connectors/connector.ts`

- Add `tableDiscoveryMode` getter defaulting to `TableDiscoveryMode.LIST`
- Add `searchTables(searchTerm: string): Promise<{ tables: TablePreview[], hasMore: boolean }>` with a default that throws. Connectors opting into SEARCH mode will override both.

### 3. Add `discoveryMode` to `TableList` response

**File:** `server/src/remote-service/connector-account/entities/table-list.entity.ts`

Add `discoveryMode: TableDiscoveryMode` to `TableList`. The existing `GET /:connectorAccountId/tables` response will include it.

**File:** `server/src/remote-service/connector-account/connector-account.service.ts`

Update `listTables` to also return the connector's `discoveryMode`. No behavioral change — all connectors are LIST mode so they all still return their full table list.

**File:** `server/src/remote-service/connector-account/connector-account.controller.ts`

Update `listTables` handler to include `discoveryMode` from the service result in the response.

### 4. Add search endpoint

**File:** `server/src/remote-service/connector-account/connector-account.controller.ts`

New endpoint:

```
GET /:connectorAccountId/tables/search?searchTerm=...
```

**File:** `server/src/remote-service/connector-account/entities/table-list.entity.ts`

Add `TableSearchResult` type: `{ tables: TablePreview[], hasMore: boolean }`

**File:** `server/src/remote-service/connector-account/connector-account.service.ts`

New method `searchTables(connectorAccountId, searchTerm, actor)`:

- Gets connector (same pattern as `listTables`)
- Verifies connector is SEARCH mode, throws BadRequestException if not
- If searchTerm is empty/blank, returns `{ tables: [], hasMore: false }`
- Otherwise calls `connector.searchTables(searchTerm)` and returns the result

### 5. Update client types

**File:** `client/src/types/server-entities/table-list.ts`

- Add `discoveryMode: TableDiscoveryMode` to `TableList`
- Add `TableSearchResult` interface: `{ tables: TablePreview[], hasMore: boolean }`
- Import `TableDiscoveryMode` from `@spinner/shared-types`

### 6. Add client API method

**File:** `client/src/lib/api/connector-accounts.ts`

Add `searchTables(workbookId, connectorAccountId, searchTerm)` method. Existing methods untouched.

## Files Modified

1. `packages/shared-types/src/enums/enums.ts` — add `TableDiscoveryMode` enum
2. `server/src/remote-service/connectors/connector.ts` — add `tableDiscoveryMode` getter + `searchTables` method
3. `server/src/remote-service/connector-account/entities/table-list.entity.ts` — add `discoveryMode` to `TableList`, add `TableSearchResult`
4. `server/src/remote-service/connector-account/connector-account.service.ts` — update `listTables` return, add `searchTables` method
5. `server/src/remote-service/connector-account/connector-account.controller.ts` — update `listTables` response, add search endpoint
6. `client/src/types/server-entities/table-list.ts` — add `discoveryMode`, `TableSearchResult`
7. `client/src/lib/api/connector-accounts.ts` — add `searchTables` method

## Verification

1. `cd server && nvm use && yarn run build`
2. `cd client && nvm use && yarn run build`
3. `cd server && yarn run lint-strict`
4. `cd client && yarn run lint-strict`
5. `cd server && yarn run test`
