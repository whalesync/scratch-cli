# scratch-cli Project

## Overview

This is the `scratch-cli` Go project containing the `scratchmd` CLI tool - a command-line application that synchronizes local Markdown files with CMS platforms like Webflow and WordPress.

## Project Structure

```
scratch-cli/
├── cmd/
│   └── scratchmd/
│       └── main.go              # Entry point (builds to `scratchmd` binary)
├── internal/
│   ├── cmd/
│   │   ├── root.go              # Root command and CLI setup
│   │   └── setup.go             # Interactive setup wizard
│   ├── config/
│   │   └── secrets.go           # Secrets/account configuration management
│   └── providers/
│       └── providers.go         # CMS provider implementations (Webflow, WordPress)
├── go.mod                       # Go module: github.com/whalesync/scratch-cli
├── go.sum                       # Dependency checksums
├── build.md                     # Build instructions
├── README.md                    # User documentation
└── CLAUDE.md                    # This file (AI context)
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
gotfmt -w .
```

## Implemented Commands

### `setup`

Interactive wizard for account configuration:

- Prompts for provider (Webflow/WordPress)
- Asks for account name and API key
- Tests connection against provider API
- Saves to `.scratchmd.secrets.yaml`
- Updates `.gitignore` automatically

## Planned Commands

- `account` - Account management (add, list, remove) - non-interactive
- `content` / `download` / `upload` - Content sync operations
- `status` / `diff` - Change tracking

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

The tool uses these config files (see shaping.md for details):

- `.scratchmd.secrets.yaml` - API keys (gitignored, created by `setup`)
- `scratchmd.config.yaml` - Global settings (planned)
- `<table>/scratchmd.config.yaml` - Per-table config (planned)
- `<table>/scratchmd.schema.yaml` - CMS schema cache (planned)

## Development Guidelines

1. **Commands go in internal/cmd/**: Each command gets its own file (e.g., `account.go`, `download.go`)
2. **Use Cobra conventions**: Subcommands, flags, persistent flags
3. **Error handling**: Return errors up, let main.go handle exit codes
4. **Testing**: Use table-driven tests, mock CMS APIs
5. **Providers implement interface**: Add new CMS providers by implementing the `Provider` interface

## Related Files

- `shaping.md` - Full product specification
- `task1-specs.md` - Task breakdown
