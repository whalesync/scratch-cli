# Implementation Plan: Remove SnapshotTable UI

**Goal:** Remove the table-based view UI (`/workbooks-md/`) and consolidate on file-based views (`/workbooks/`).

**Scope:**

- Client-side changes only (no server changes)
- Remove UI components, not backend functionality
- No migration for existing workbooks with tables

---

## Phase 1: Remove Table-Based Route & Pages

**Estimated effort:** Low

### 1.1 Delete `/workbooks-md/` Route

Delete the entire directory:

```
client/src/app/workbooks-md/[...slug]/
├── page.tsx
├── layout.tsx (if exists)
└── components/
    ├── AddTableTab.tsx
    ├── ManageTablesModal.tsx
    ├── SnapshotTableGrid.tsx (if exists)
    ├── types.ts
    └── ... other table-specific components
```

### 1.2 Update Navigation/Links

Search for and update any links pointing to `/workbooks-md/`:

- Sidebar navigation
- Workbook cards/links in dashboard
- Any redirects or router logic

**Files to check:**

- `client/src/app/` - any navigation components
- `client/src/components/` - shared navigation
- `client/src/lib/` - route constants if any

---

## Phase 2: Clean Up Table Selection Components

**Estimated effort:** Medium

### 2.1 Remove Table Selection UI Components

These components are for selecting tables in various workflows:

| File                                                      | Purpose                           | Action |
| --------------------------------------------------------- | --------------------------------- | ------ |
| `client/src/app/components/SelectTableRow.tsx`            | Row in table selection list       | Delete |
| `client/src/app/components/TableSelectionComponent.tsx`   | Table radio/checkbox selector     | Delete |
| `client/src/app/components/modals/TableSelectorModal.tsx` | Modal wrapper for table selection | Delete |

### 2.2 Audit Usages

Before deleting, search for imports of these components and update/remove the calling code:

```bash
grep -r "SelectTableRow\|TableSelectionComponent\|TableSelectorModal" client/src/
```

---

## Phase 3: Clean Up State Management

**Estimated effort:** Medium

### 3.1 Update `workbook-editor-store.ts`

**File:** `client/src/stores/workbook-editor-store.ts`

Remove table-specific state:

- `tabs: (TableTabState | NewTabState)[]`
- `activeTab: TabId | null`
- `activeCells: ActiveCells | null`
- `recordDetailsVisible: boolean`
- `publishConfirmationOpen: boolean`
- `preselectedPublishTableIds: SnapshotTableId[]`

Remove table-specific actions:

- `setActiveTab()`
- `setActiveCells()`
- `openNewBlankTab()`
- `closeTab()`
- `reconcileWithWorkbook()`
- Any table-related selectors

Keep file-based state:

- `openFileTabs[]`
- `activeFileTabId`
- `openFileTab()`
- `closeFileTab()`
- `setActiveFileTab()`

### 3.2 Update Store Consumers

Search for components using removed store state:

```bash
grep -r "useWorkbookEditorUIStore\|useWorkbookEditorStore" client/src/
```

Update each consumer to remove table-related state usage.

---

## Phase 4: Clean Up Hooks

**Estimated effort:** Low

### 4.1 Remove/Update Table-Related Hooks

| File                                      | Purpose                       | Action                    |
| ----------------------------------------- | ----------------------------- | ------------------------- |
| `client/src/hooks/use-active-workbook.ts` | Returns current SnapshotTable | Delete or simplify        |
| `client/src/hooks/use-workbook-params.ts` | Parses `tableId` from URL     | Remove `tableId` handling |
| `client/src/hooks/use-all-tables.ts`      | Lists tables for selection    | Delete if exists          |

### 4.2 Audit Hook Usages

Before deleting, search for hook usages:

```bash
grep -r "useActiveWorkbook\|useWorkbookParams" client/src/
```

---

## Phase 5: Clean Up API Layer

**Estimated effort:** Low

### 5.1 Remove Unused API Methods (Client-Side Only)

**File:** `client/src/lib/api/workbook.ts`

Remove or comment out unused table methods (keeping server endpoints intact):

- `workbookApi.addTable()`
- `workbookApi.hideTable()`
- `workbookApi.deleteTable()`
- `workbookApi.updateColumnSettings()`
- `workbookApi.setTitleColumn()`
- `workbookApi.setContentColumn()`
- `workbookApi.hideColumn()`
- `workbookApi.unhideColumn()`
- `workbookApi.clearHiddenColumns()`

### 5.2 Clean Up SWR Keys

**File:** `client/src/lib/api/keys.ts`

Remove unused cache keys:

- `SWR_KEYS.workbook.records()`
- Any other table-specific keys

---

## Phase 6: Clean Up Types & Utilities

**Estimated effort:** Low

### 6.1 Remove Type References

**File:** `client/src/types/server-entities/workbook.ts`

- Remove SnapshotTable-specific type utilities (keep base type for now since server still uses it)

**File:** `client/src/utils/snapshot-helpers.ts`

- Remove `getSnapshotTables()` helper
- Remove any other table-filtering utilities

### 6.2 Remove Component Type Definitions

**File:** `client/src/app/workbooks-md/[...slug]/components/types.ts`

- Will be deleted with Phase 1

---

## Phase 7: Clean Up Styles

**Estimated effort:** Low

### 7.1 Audit AG Grid CSS

**Directory:** `client/src/ag-grid-css/`

Review and remove table-specific styles if not used by `FolderDetailViewer`:

- SnapshotGrid-specific classes
- Table cell styling that's no longer needed

Keep styles used by `FolderDetailViewer.tsx` for file listings.

---

## Implementation Order

Recommended sequence to minimize broken states:

1. **Phase 2** - Remove table selection components (isolated, low risk)
2. **Phase 4** - Clean up hooks (removes dependencies)
3. **Phase 3** - Clean up state management (depends on Phase 4)
4. **Phase 5** - Clean up API layer (isolated)
5. **Phase 6** - Clean up types & utilities (isolated)
6. **Phase 1** - Delete `/workbooks-md/` route (final step, ensures nothing depends on it)
7. **Phase 7** - Clean up styles (last, audit after everything else)

---

## Verification Checklist

After each phase:

- [ ] `yarn build` passes with no errors
- [ ] `yarn lint` passes
- [ ] App loads without console errors
- [ ] File-based workbook view (`/workbooks/`) still works
- [ ] No dead imports or references

Final verification:

- [ ] Search codebase for `SnapshotTable` - should only exist in shared types
- [ ] Search for `/workbooks-md` - should not exist
- [ ] Search for `TableTab` - should not exist
- [ ] Test file editing workflow end-to-end

---

## Files Summary

### To Delete

```
client/src/app/workbooks-md/                    # Entire directory
client/src/app/components/SelectTableRow.tsx
client/src/app/components/TableSelectionComponent.tsx
client/src/app/components/modals/TableSelectorModal.tsx
client/src/hooks/use-active-workbook.ts
client/src/utils/snapshot-helpers.ts            # If only contains table utilities
```

### To Modify

```
client/src/stores/workbook-editor-store.ts      # Remove table state
client/src/hooks/use-workbook-params.ts         # Remove tableId handling
client/src/lib/api/workbook.ts                  # Remove table API methods
client/src/lib/api/keys.ts                      # Remove table cache keys
client/src/types/server-entities/workbook.ts    # Remove table type utilities
```

### To Keep

```
client/src/app/workbooks/[...slug]/             # File-based view (main view)
client/src/app/workbooks/[...slug]/components/FolderDetailViewer.tsx  # AG Grid file list
client/src/ag-grid-css/                         # Audit, but likely keep for FolderDetailViewer
```

---

## Risk Assessment

| Risk                      | Likelihood | Impact | Mitigation                                  |
| ------------------------- | ---------- | ------ | ------------------------------------------- |
| Breaking file-based views | Low        | High   | Careful to only remove table-specific code  |
| Missed dependencies       | Medium     | Medium | Thorough grep searches before each deletion |
| Build failures            | Low        | Low    | Incremental changes with build checks       |

---

## Future Work (Out of Scope)

- Remove SnapshotTable from server-side
- Database migration to remove table data
- Remove `@spinner/shared-types` SnapshotTable type
