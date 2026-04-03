# scratchmd CLI

CLI for [Scratch](https://www.scratch.md) — bulk edit your content with AI. Pull content from Shopify, Webflow, WordPress, Airtable, Notion, and more as local files. Edit with any tool — AI, scripts, spreadsheets — then push changes back with full diff visibility and control.

## Prerequisites

- **macOS:** Git is required. The easiest way to install it is with the Xcode Command Line Tools:
  ```bash
  xcode-select --install
  ```

## Installation

### Homebrew (macOS, Linux, WSL)

```bash
brew install whalesync/scratch-cli/scratchmd
```

### Scoop (Windows)

Install [Scoop](https://scoop.sh/) if needed

```powershell
scoop install https://raw.githubusercontent.com/whalesync/scratch-cli-bucket/main/scratchmd.json
```

### Version Check & Manual Installation

```bash
scratchmd --version
```

For manual installation options, see [MANUAL_INSTALL.md](MANUAL_INSTALL.md).

---

## Getting Started

```bash
# 1. Log in via browser
scratchmd auth login

# 2. Create a workbook
scratchmd workbooks create --name "My Site"

# 3. Connect an external service
scratchmd connections create --service webflow --display-name "My Webflow"

# 4. Pull content from connected services
scratchmd workbooks pull <workbook-id>
```

---

## Usage

Run `scratchmd --help` to see all available commands, or `scratchmd <command> --help` for details on a specific command.
