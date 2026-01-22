# scratchmd CLI

Sync local Markdown files with your CMS (Webflow, WordPress, and more).
Check out www.scratch.md for more info.

## Installation

### Homebrew (macOS, Linux, WSL)

```bash
brew tap whalesync/scratch-cli
brew install scratchmd
```

### Scoop (Windows)

```powershell
scoop bucket add whalesync https://github.com/whalesync/scratch-cli-bucket
scoop install scratchmd
```

### Version Check & Manual Installation

```bash
scratchmd --version
```

For manual installation options, see [MANUAL_INSTALL.md](MANUAL_INSTALL.md).

---

## Getting Started

### Option 1: quick setup (recommended)

```bash
scratchmd setup
```

### Option 2: Manual setup

```bash
# 1. Add your CMS account
scratchmd account add my-site --provider=webflow --api-key=YOUR_KEY

# 2. Link a local folder to a CMS collection
scratchmd folder link --table-id=TABLE_ID ./my-content

# 3. Download content
scratchmd content download
```

## Utilities

### Shell Completion

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
source <(scratchmd completion $(basename $SHELL))
```

### VSCode Extension

Coming Soon
