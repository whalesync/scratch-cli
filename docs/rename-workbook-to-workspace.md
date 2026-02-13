# Rename "workbook" → "workspace" (public-facing)

## Context

The product concept "workbook" is being renamed to "workspace" in all user-facing text. Internal code (variable names, API endpoints, DB tables, types) stays unchanged. The CLI needs backwards compatibility via aliases so both `workbooks` and `workspaces` commands work during a transition period.

## Changes

### 1. CLI Command Alias (`scratch-cli/internal/cmd/workbooks.go`)

**Primary command becomes `workspaces`, alias `workbooks`:**

- Change `workbooksCmd.Use` from `"workbooks"` to `"workspaces"` and add `Aliases: []string{"workbooks"}`
- Change `workbooksInitCmd.Use` from `"init <workbook-id>"` to `"init <workspace-id>"`
- Update all `Short`/`Long` strings: "workbook" → "workspace", "workbooks" → "workspaces"
- Update all `fmt.Printf`/`fmt.Println` user-facing messages (e.g., `"No workbooks found."` → `"No workspaces found."`, `"Workbook created successfully!"` → `"Workspace created successfully!"`, etc.)
- Update flag description: `"Workbook name"` → `"Workspace name"` (line 126)

**Leave unchanged:**

- Go variable names (`workbooksCmd`, `workbookID`, `WorkbookMarker`, etc.)
- Struct types and field names
- JSON output field names (`workbookId`, `workbookName` in `InitResult`)
- YAML marker keys (`yaml:"workbook"`)
- Internal comments about code logic (only update comments that are part of user-facing help text)

### 2. CLI `--workbook` flag → `--workspace` with alias (`scratch-cli/internal/cmd/`)

For each command that registers `--workbook`:

- **linked.go** (line 136): Register `--workspace` as the primary flag, then add `--workbook` as a hidden alias
- **connections.go** (line 129): Same approach
- **syncs.go** (line 111): Same approach

**Pattern for each:**

```go
cmd.PersistentFlags().String("workspace", "", "Workspace ID (auto-detected from .scratchmd if not set)")
cmd.PersistentFlags().String("workbook", "", "Workspace ID (auto-detected from .scratchmd if not set)")
cmd.PersistentFlags().MarkHidden("workbook")
```

**Update `resolveWorkbookContext`** in `linked.go` (line 211-228):

- Check `--workspace` first, then fall back to `--workbook`
- Update error message: `"not inside a workbook directory. Use --workbook flag..."` → `"not inside a workspace directory. Use --workspace flag or run from a workspace directory"`

**Update `files.go`** (line 140):

- Change `cmd.Flags().Lookup("workbook")` to check `"workspace"` first, then `"workbook"`
- Update error messages at lines 157, 173

### 3. CLI Help Text in Other Commands

**root.go** (~lines 35-70): Update the help text section header and all command descriptions:

- `WORKBOOKS` → `WORKSPACES`
- `workbooks list    List all workbooks` → `workspaces list    List all workspaces`
- Similar for all other entries in help
- Also update lines referencing "workbook" in connections/linked/syncs sections

**connections.go**: Update `Short`/`Long` descriptions and user-facing strings:

- `"Manage connections (connector accounts) in a workbook"` → `"...in a workspace"`
- `"List all connections in the workbook"` → `"...in the workspace"`
- `"No connections found in this workbook."` → `"...in this workspace."`
- Flag description updates
- Example strings in Long help

**syncs.go**: Update `Short`/`Long` descriptions and user-facing strings:

- `"Manage sync configurations for a workbook"` → `"...for a workspace"`
- `"No syncs found in this workbook."` → `"...in this workspace."`

**linked.go**: Update all `Short`/`Long` descriptions and user-facing strings:

- `"List linked tables in a workbook"` → `"...in a workspace"`
- `"Link a new table to a workbook"` → `"...to a workspace"`
- `"Pull CRM changes into the workbook"` → `"...into the workspace"`
- `"No connections found in this workbook."` → `"...in this workspace."`
- `"No linked tables found in this workbook."` → `"...in this workspace."`
- Example commands in Long help: `--workbook` → `--workspace`

**files.go**: Update `Short`/`Long` descriptions and user-facing strings:

- `"Manage workbook files"` → `"Manage workspace files"`
- `"Manage files in a workbook"` → `"...in a workspace"`
- Error messages referencing "workbook directory" → "workspace directory"
- References to `workbooks init` → `workspaces init`

### 4. CLI API Client Strings (`scratch-cli/internal/api/client_workbooks.go`)

**Leave unchanged** — these are internal code (API endpoint paths, struct names, etc.).

### 5. CLI Documentation

**README.md**: Replace all user-facing "workbook"/"workbooks" with "workspace"/"workspaces" in command examples and descriptions.

**CLAUDE.md**: Same replacements in the Available Commands section and Common Flags table.

**AGENT.md**: Same replacements throughout.

### 6. Client UI Strings (`client/src/`)

**`app/workbook/[id]/layout.tsx`:**

- `"Loading workbook..."` → `"Loading workspace..."`
- `"Workbook not found."` → `"Workspace not found."`
- `"We were unable to find the workbook you are looking for."` → `"...the workspace..."`

**`app/workbook/[id]/components/MainPane/DebugMenu.tsx`:**

- `"Reset Workbook"` → `"Reset Workspace"` (dialog title + menu item)
- `"Failed to reset workbook"` → `"Failed to reset workspace"`

**`app/settings/dev/gallery/page.tsx`:**

- `"...in new workbooks."` → `"...in new workspaces."`

**`lib/api/workbook.ts`** — error messages:

- `"Failed to fetch workbooks"` → `"Failed to fetch workspaces"`
- `"Failed to fetch workbook"` → `"Failed to fetch workspace"`
- `"Failed to create a workbook"` → `"Failed to create a workspace"`
- `"Failed to update workbook"` → `"Failed to update workspace"`
- `"Failed to delete workbook"` → `"Failed to delete workspace"`
- `"Failed to backup workbook"` → `"Failed to backup workspace"`
- `"Failed to reset workbook"` → `"Failed to reset workspace"`

**`hooks/use-workbook.ts`:**

- `"Workbook not found"` → `"Workspace not found"`

**`lib/api/job.ts`:**

- `"Failed to fetch active jobs for workbook"` → `"...for workspace"`

**Leave unchanged in client:**

- All file names, directory names, route paths (`/workbook/[id]/...`)
- All code identifiers (hooks, stores, types, variables)
- Console.debug messages (developer-facing)
- API endpoint paths in fetch calls

## Files Modified

### CLI (scratch-cli/)

1. `internal/cmd/workbooks.go` — command defs, user strings
2. `internal/cmd/root.go` — help text
3. `internal/cmd/linked.go` — flag, help text, `resolveWorkbookContext`, user strings
4. `internal/cmd/connections.go` — flag, help text, user strings
5. `internal/cmd/syncs.go` — flag, help text, user strings
6. `internal/cmd/files.go` — flag lookup, help text, user strings
7. `README.md`
8. `CLAUDE.md`
9. `AGENT.md`

### Client (client/)

10. `src/app/workbook/[id]/layout.tsx`
11. `src/app/workbook/[id]/components/MainPane/DebugMenu.tsx`
12. `src/app/settings/dev/gallery/page.tsx`
13. `src/lib/api/workbook.ts`
14. `src/hooks/use-workbook.ts`
15. `src/lib/api/job.ts`

## Verification

1. **CLI builds**: `cd scratch-cli && go build ./...`
2. **Both command names work**: `scratchmd workspaces list` and `scratchmd workbooks list` produce identical results
3. **Both flags work**: `--workspace` and `--workbook` are accepted
4. **Help text shows "workspace"**: `scratchmd workspaces --help` shows new terminology; `scratchmd workbooks --help` also works
5. **Hidden old flag**: `scratchmd linked --help` shows `--workspace` but NOT `--workbook`
6. **Client builds**: `cd client && yarn run build`
7. **Client UI strings**: spot-check that "workbook" no longer appears in user-facing text
