# Remove `listAllUserTables()` Implementation Plan

## Problem

`listAllUserTables()` fetches tables from **every** connection in a workbook by calling each
connector's `listTables()` in parallel. This is wasteful — every caller already knows (or can
easily determine) which specific connection they care about.

The only UI consumer (`ChooseTablesModal`) already receives a `connectorAccount` prop, fetches
all tables, then immediately filters to just that one connection's tables.

The CLI flows (`linked available`, `linked add`) can be restructured to list connections first,
then list tables for a selected connection.

## Scope

1. Remove the `listAllUserTables()` method and its `all-tables` endpoints
2. Convert the per-connection `listTables` endpoint from POST to GET
3. Update the React UI to call `listTables` per-connection
4. Update the CLI to use a two-step flow (list connections, then list tables)

## Changes by Layer

### Phase 1: Server — Convert `listTables` to GET

**File: `server/src/remote-service/connector-account/connector-account.controller.ts`**

- Change the `listTables` endpoint from `POST /tables` with body `{ service, connectorAccountId }`
  to `GET /:connectorAccountId/tables`
- The `service` field is unnecessary — the server can look it up from the connector account record
- Remove or update `ListTablesDto` accordingly

Before:

```typescript
@Post('tables')
async listTables(
  @Param('workbookId') workbookId: string,
  @Body() dtoParam: ListTablesDto,
  @Req() req: RequestWithUser,
): Promise<TableList> {
  const dto = dtoParam as ValidatedListTablesDto;
  const tables = await this.service.listTables(dto.service, dto.connectorAccountId ?? null, userToActor(req.user));
  return { tables };
}
```

After:

```typescript
@Get(':connectorAccountId/tables')
async listTables(
  @Param('workbookId') workbookId: string,
  @Param('connectorAccountId') connectorAccountId: string,
  @Req() req: RequestWithUser,
): Promise<TableList> {
  const tables = await this.service.listTables(connectorAccountId, userToActor(req.user));
  return { tables };
}
```

**File: `server/src/remote-service/connector-account/connector-account.service.ts`**

- Simplify `listTables()` signature: remove the `service` parameter, derive it from the account
- Remove the `connectorAccountId: string | null` case (null is no longer needed)
- Remove `listAllUserTables()` entirely

Before:

```typescript
async listTables(service: Service, connectorAccountId: string | null, actor: Actor): Promise<TablePreview[]>
```

After:

```typescript
async listTables(connectorAccountId: string, actor: Actor): Promise<TablePreview[]>
```

**File: `packages/shared-types/src/dto/connector-account/list-tables.dto.ts`**

- Remove `ListTablesDto` and `ValidatedListTablesDto` (no longer needed with path params)
- Or repurpose if there are other consumers — check first

### Phase 2: Server — Remove `all-tables` endpoints

**File: `server/src/remote-service/connector-account/connector-account.controller.ts`**

- Remove the `GET all-tables` / `listAllTables()` handler

**File: `server/src/cli/cli-connection.controller.ts`**

- Remove the `GET all-tables` / `listAllTables()` handler

**File: `server/src/remote-service/connector-account/connector-account.service.ts`**

- Remove `listAllUserTables()` method (lines 245-277)

**File: `server/src/remote-service/connector-account/entities/table-list.entity.ts`**

- Remove `TableGroup` type if no longer used

### Phase 3: Client — Switch to per-connection `listTables`

**File: `client/src/hooks/use-all-tables.ts`**

- Delete this file entirely

**File: `client/src/lib/api/connector-accounts.ts`**

- Remove `listAllTables()` method
- Update `listTables()` to use `GET /workbooks/${workbookId}/connections/${connectorAccountId}/tables`
  instead of `POST /workbooks/${workbookId}/connections/tables`
- Simplify signature: `listTables(workbookId, connectorAccountId)` (no `service` param needed)

**File: `client/src/lib/api/keys.ts`**

- Remove `allTables` SWR key
- Add/update a per-connection tables key, e.g.:
  `tables: (workbookId: string, connectorAccountId: string) => ['connector-accounts', 'tables', workbookId, connectorAccountId]`

**File: `client/src/app/workbook/[id]/components/shared/ChooseTablesModal.tsx`**

- Replace `useAllTables(workbookId)` with a direct call (or new hook) to
  `connectorAccountsApi.listTables(workbookId, connectorAccount.id)`
- Remove the `useMemo` that filters `allTableGroups` — no longer needed

**File: `client/src/types/server-entities/table-list.ts`**

- Remove `TableGroup` type if no longer used client-side

### Phase 4: CLI (Go) — Two-step flow

**File: `scratch-cli/internal/api/client_linked.go`**

- Remove `ListAvailableTables()` method (or rename/rework it)
- Add `ListConnectionTables(workbookID, connectorAccountID string) ([]TablePreview, error)` that
  calls `GET /workbooks/{workbookID}/connections/{connectorAccountID}/tables`
- Note: CLI uses the main controller endpoints (same `ScratchAuthGuard` supports API-Token auth)
- Remove `TableGroup` struct if no longer needed

**File: `scratch-cli/internal/cmd/linked.go`**

- **`runLinkedAvailable`**: Require a connection ID argument, or change to a two-step flow:
  1. List connections (`GET /workbooks/:id/connections`)
  2. List tables for each/selected connection
- **`runLinkedAdd` (interactive)**: Change to two-step interactive flow:
  1. Fetch connections, prompt user to select one
  2. Fetch tables for selected connection, prompt user to select table(s)

### Phase 5: Documentation

**File: `docs/api-design-external.md`**

- Remove the "List All Tables" section documenting `GET /connector-accounts/all-tables`
- Update the per-connection tables endpoint documentation to reflect the new GET route

## Verification

- `cd server && nvm use && yarn build` — confirm server compiles
- `cd server && yarn lint-strict` — confirm no lint errors
- `cd server && yarn test` — run unit tests
- `cd client && nvm use && yarn build` — confirm client compiles
- `cd client && yarn lint` — confirm no lint errors
- `cd scratch-cli && go build ./...` — confirm CLI compiles
- Manual test: open ChooseTablesModal in the UI, confirm tables load for a connection
- Manual test: `scratchmd linked available <connection-id>` works
- Manual test: `scratchmd linked add` interactive flow works

## Notes

- The CLI controller (`cli-connection.controller.ts`) has a pre-existing gap: it does not log
  audit events or PostHog analytics for create/delete operations. Out of scope for this change.
- The `service` parameter can be removed from the `listTables` flow entirely — the server already
  loads the connector account record which includes the service type.
