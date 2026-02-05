# scratch-cli Project

## Overview

This is the `scratch-cli` Go project containing the `scratchmd` CLI tool - a command-line application for authenticating with Scratch.md.

## Project Structure

```
scratch-cli/
├── cmd/
│   └── scratchmd/
│       └── main.go              # Entry point (builds to `scratchmd` binary)
├── internal/
│   ├── cmd/
│   │   ├── root.go              # Root command and CLI setup
│   │   └── auth.go              # Auth commands (login, logout, status)
│   ├── config/
│   │   ├── config.go            # Configuration management
│   │   ├── credentials.go       # Credentials storage
│   │   └── overrides.go         # Config overrides
│   └── api/
│       └── client.go            # API client for server communication
├── go.mod                       # Go module: github.com/whalesync/scratch-cli
├── go.sum                       # Dependency checksums
├── CLAUDE.md                    # This file (development context for AI)
└── README.md                    # User documentation
```

## Technology Stack

- **Language**: Go 1.21+
- **CLI Framework**: [Cobra](https://github.com/spf13/cobra) - industry standard for Go CLIs
- **YAML**: [gopkg.in/yaml.v3](https://pkg.go.dev/gopkg.in/yaml.v3) - for configuration files

## Naming Convention

- **Project name**: `scratch-cli` (repo, module, folder)
- **CLI command**: `scratchmd` (the binary users run)
- **Config files**: `.scratchmd.*` (user-facing files use the command name)

## Key Design Decisions

1. **Cobra for CLI**: Using spf13/cobra for command structure, flag parsing, and help generation
2. **Internal package**: Business logic lives in `internal/` to prevent external imports
3. **Version injection**: Version info is injected at build time via ldflags
4. **Device code auth**: Uses OAuth device code flow for authentication

---

## Available Commands

### Authentication

```bash
scratchmd auth login     # Authenticate with Scratch.md (opens browser)
scratchmd auth logout    # Remove stored credentials
scratchmd auth status    # Show current authentication status
```

### Flags

| Flag | Commands | Description |
|------|----------|-------------|
| `--no-browser` | auth login | Don't open browser automatically |
| `--server` | auth * | Override the server URL |
| `--scratch-url` | global | Override scratch server URL |

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

- `config.go` - Loads/saves `scratchmd.config.yaml`
- `credentials.go` - Manages API credentials stored in `~/.scratchmd/credentials.yaml`
- `overrides.go` - CLI flag overrides for config values

### `internal/api/`

API client for communicating with the Scratch.md server.

## Configuration Files

The tool uses these config files:

- `~/.scratchmd/credentials.yaml` - API tokens per server (created by `auth login`)
- `scratchmd.config.yaml` - Project settings (optional)

## Development Guidelines

1. **Commands go in internal/cmd/**: Each command gets its own file
2. **Use Cobra conventions**: Subcommands, flags, persistent flags
3. **Error handling**: Return errors up the call stack
4. **Run gofmt -w .** after changes
5. **Test with go build ./...** to verify compilation
