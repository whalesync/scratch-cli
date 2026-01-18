# scratch-cli

A command-line tool (`scratchmd`) that synchronizes local Markdown files with CMS platforms like Webflow and WordPress.

## Overview

`scratchmd` enables local editing of CMS content using AI tools like Claude Code, Cursor, or any text editor. Content is stored as Markdown files with YAML frontmatter, making it easy to manipulate with your preferred tools.

### Key Features

- **Pull** CMS content into local, text-based Markdown files
- **Edit** using your preferred local AI agent with full filesystem context
- **Push** changes back to CMS programmatically
- **Two-way sync** with intelligent conflict handling

## Installation

### From Source

````bash
# Clone the repository
git clone https://github.com/whalesync/scratch-cli.git
cd scratch-cli

# Build the binary
go build -o scratchmd ./cmd/scratchmd

# Optionally, install globally
go install ./cmd/scratchmd

### Developer Install (After Changes)

To rebuild and install the latest version after making changes:

```bash
cd cmd/scratchmd && go build && go install
````

````

See [build.md](build.md) for detailed build instructions including cross-platform builds.

## Usage

### Getting Help

```bash
# Show help and available commands
scratchmd --help

# Show version information
scratchmd --version

# Get help for a specific command
scratchmd <command> --help
````

### Example Output

```
$ scratchmd --help
scratchmd is a command-line tool that synchronizes a local folder with
CMS platforms like Webflow and WordPress.

It enables local editing of CMS content using AI tools like Claude Code,
Cursor, or other editors. Content is stored as Markdown files with YAML
frontmatter for easy manipulation.

Key features:
  • Pull CMS content into local, text-based Markdown files
  • Edit using your preferred local AI agent with full context
  • Push changes back to CMS programmatically
  • Two-way sync with intelligent conflict handling

Example usage:
  scratchmd setup                  # Interactive setup wizard
  scratchmd account add mysite     # Add a CMS account
  scratchmd download               # Pull content from CMS
  scratchmd upload                 # Push changes to CMS
  scratchmd status                 # Show pending changes

For more information, visit: https://github.com/whalesync/scratch-cli

Usage:
  scratchmd [command]

Available Commands:
  help        Help about any command
  setup       Interactive setup wizard for configuring scratchmd

Flags:
      --config string   Config file path (default: .scratchmd.config.yaml)
  -h, --help            help for scratchmd
  -v, --verbose         Enable verbose output
      --version         version for scratchmd

Use "scratchmd [command] --help" for more information about a command.
```

## Available Commands

### `scratchmd setup`

Interactive setup wizard that helps you:

- Add CMS account connections (Webflow, WordPress)
- Store API keys securely in `.scratchmd.secrets.yaml`
- Test your credentials against the provider API

The secrets file is automatically added to `.gitignore` for security.

## Planned Commands

The following commands are planned for future releases:

| Command          | Description                         |
| ---------------- | ----------------------------------- |
| `account add`    | Add a CMS account (non-interactive) |
| `account list`   | List configured accounts            |
| `account remove` | Remove an account                   |
| `download`       | Pull content from CMS               |
| `upload`         | Push changes to CMS                 |
| `status`         | Show pending changes                |
| `diff`           | Show detailed diff of changes       |

## License

Private
