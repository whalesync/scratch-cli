# scratch-cli Project

## Overview

This is the `scratch-cli` Go project containing the `scratchmd` CLI tool - a command-line application that synchronizes local JSON files with CMS platforms like Webflow and WordPress.

## Project Structure

```
scratch-cli/
├── cmd/
│   └── scratchmd/
│       └── main.go              # Entry point (builds to `scratchmd` binary)
├── internal/
│   ├── cmd/
│   │   ├── root.go              # Root command and CLI setup
│   │   ├── account.go           # Account management commands
│   │   ├── content.go           # Content sync commands (download, upload, pull, push)
│   │   ├── status.go            # Status command
│   │   └── setup.go             # Interactive setup wizard
│   ├── config/
│   │   └── secrets.go           # Secrets/account configuration management
│   └── providers/
│       └── providers.go         # CMS provider implementations (Webflow, WordPress)
├── go.mod                       # Go module: github.com/whalesync/scratch-cli
├── go.sum                       # Dependency checksums
├── AGENT.md                     # Quick reference for AI agents using the CLI
├── CLAUDE.md                    # This file (development context for AI)
├── build.md                     # Build instructions
└── README.md                    # User documentation
```

## Technology Stack

- **Language**: Go 1.21+
- **CLI Framework**: [Cobra](https://github.com/spf13/cobra) - industry standard for Go CLIs
- **Interactive Prompts**: [Survey](https://github.com/AlecAivazis/survey) - for interactive CLI wizards
- **YAML**: [gopkg.in/yaml.v3](https://pkg.go.dev/gopkg.in/yaml.v3) - for configuration files

## Naming Convention

- **Project name**: `scratch-cli` (repo, module, folder)
- **CLI command**: `scratchmd` (the binary users run)
- **Config files**: `.scratchmd.*` (user-facing files use the command name)

## Key Design Decisions

1. **Cobra for CLI**: Using spf13/cobra for command structure, flag parsing, and help generation
2. **Internal package**: Business logic lives in `internal/` to prevent external imports
3. **Version injection**: Version info is injected at build time via ldflags
4. **Subcommand pattern**: Commands like `account add`, `content download` follow Git-style subcommands
5. **Provider abstraction**: CMS providers implement a common interface for testability

---

## LLM-Friendly CLI Design Patterns

This CLI is designed to be used by AI agents (Claude, GPT, etc.). Follow these patterns when adding or modifying commands:

### Command Categories

Commands are divided into two categories:

1. **NON-INTERACTIVE** (safe for LLM/automation use):
   - No TTY required, no user prompts
   - Mark with `[NON-INTERACTIVE]` prefix in Short description
   - Add `[NON-INTERACTIVE - safe for LLM use]` at start of Long description
   - Examples: `account add`, `account list`, `content download`, `status`

2. **INTERACTIVE** (requires human):
   - Uses prompts, spinners, or requires TTY
   - Examples: `setup`, `account setup`

### JSON Output Flag

All discovery/query commands MUST support `--json` for machine-readable output:

```go
cmd.Flags().Bool("json", false, "Output as JSON (for automation/LLM use)")
```

Commands with `--json` support:
- `account list --json`
- `account fetch-sources --json`
- `status --json`
- `content upload --json` (and `push --json`)

When implementing `--json`:
- Output valid JSON to stdout
- Suppress spinners, progress messages, and colored output in JSON mode
- Include all relevant data (success status, errors, IDs, etc.)
- Use consistent field names across commands

### Exit Codes

Commands MUST return proper exit codes:
- **0**: Success
- **1**: Error (any failure)

Track errors during execution and return an error at the end:
```go
var hasErrors bool
// ... if something fails:
hasErrors = true
// ... at end:
if hasErrors {
    return fmt.Errorf("one or more operations failed")
}
```

### Command Aliases

Provide short aliases for common operations:
- `pull` → `content download`
- `push` → `content upload`

When creating aliases:
- Create a separate command variable with `RunE` pointing to the same function
- Copy all relevant flags to the alias command
- Document as "Alias for 'original command'" in Short/Long descriptions

### Flag Conventions

| Flag | Purpose | Commands |
|------|---------|----------|
| `--json` | Machine-readable output | Discovery commands, upload |
| `--no-review` | Skip confirmation prompts | upload, push |
| `--dry-run` | Preview without changes | upload, push |
| `--simulate` | Same as --dry-run | upload, push |
| `--sync-deletes` | Enable destructive deletes | upload, push |
| `--clobber` | Overwrite local changes | download, pull |

For destructive operations, require explicit flags and document as `(DESTRUCTIVE)`.

### Help Text Best Practices

1. **Root command Long description** should include:
   - List of LLM-friendly commands with examples
   - List of interactive commands
   - Typical workflow example
   - Quick aliases section

2. **Individual commands** should include:
   - `[NON-INTERACTIVE]` or `[INTERACTIVE]` marker
   - Clear examples
   - Flag descriptions with defaults

### ID Field Handling

Records are linked to CMS via an ID field stored in the JSON:
- Use `tableConfig.IdField` (default: `"id"`)
- Never hardcode `"id"` - always get from config
- The ID is stored directly in the JSON file (not in frontmatter)

---

## Files to Update When Making CLI Changes

When modifying commands, flags, or behavior, update these files:

1. **AGENT.md** - Quick reference for AI agents
   - Update command examples
   - Update flag tables
   - Add JSON output examples for new commands

2. **root.go** - Root command help text
   - Update COMMANDS FOR LLM/AUTOMATION section
   - Update TYPICAL LLM WORKFLOW section
   - Update QUICK ALIASES section

3. **README.md** - User documentation (if exists)
   - Keep in sync with command changes

### Checklist for New Commands

- [ ] Add `[NON-INTERACTIVE]` marker if applicable
- [ ] Add `--json` flag for query/discovery commands
- [ ] Return proper exit codes (error on failure)
- [ ] Update AGENT.md with examples
- [ ] Update root.go help text if it's a common command
- [ ] Add alias if it's a frequently-used command
- [ ] Run `gofmt -w .` after changes
- [ ] Test with `go build ./...`

---

## Building

```bash
# Quick build
go build -o scratchmd ./cmd/scratchmd

# With version info
go build -ldflags "-X 'github.com/whalesync/scratch-cli/internal/cmd.version=0.1.0'" -o scratchmd ./cmd/scratchmd
```

## Code formatting

Use the standard `gofmt` after generating code

```bash
gofmt -w .
```

## Package Details

### `internal/cmd/`

Cobra command definitions. Each command gets its own file.

### `internal/config/`

Configuration management:

- `secrets.go` - Loads/saves `.scratchmd.secrets.yaml`, manages accounts

### `internal/providers/`

Providers describe the various data sources that are supported via the CLI.

- Data sources are services like Webflow, Wordpress and Notion
- each provider has common attributes for display name and authentication
- providers may define custom features or data conversion options that can be presented to the user in standard CLI operaions
- new providers must be added to the SupportedProviders() and GetProvider() functions

## Configuration Files

The tool uses these config files:

- `.scratchmd.secrets.yaml` - API keys (gitignored, created by `setup`)
- `scratchmd.config.yaml` - Global settings
- `<table>/scratchmd.config.yaml` - Per-table config
- `<table>/scratchmd.schema.yaml` - CMS schema cache

## Development Guidelines

1. **Commands go in internal/cmd/**: Each command gets its own file (e.g., `account.go`, `content.go`)
2. **Use Cobra conventions**: Subcommands, flags, persistent flags
3. **Error handling**: Return errors up, track `hasErrors` for multi-operation commands
4. **Testing**: Use table-driven tests, mock CMS APIs
5. **Providers implement interface**: Add new CMS providers by implementing the `Provider` interface
6. **LLM-friendly**: Follow the patterns in "LLM-Friendly CLI Design Patterns" section above

## Related Files

- `AGENT.md` - Quick reference for AI agents using this CLI
- `shaping.md` - Full product specification
- `task1-specs.md` - Task breakdown
