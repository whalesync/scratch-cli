# scratchmd CLI

Sync local Markdown files with your CMS (Webflow, WordPress, and more).

## Installation

### macOS (Apple Silicon / M1-M3)

```bash
curl -L https://github.com/whalesync/scratch-cli/releases/download/v0.1.0/scratchmd_0.1.0_darwin_arm64.tar.gz | tar xz
sudo mv scratchmd /usr/local/bin/
```

### macOS (Intel)

```bash
curl -L https://github.com/whalesync/scratch-cli/releases/download/v0.1.0/scratchmd_0.1.0_darwin_amd64.tar.gz | tar xz
sudo mv scratchmd /usr/local/bin/
```

### Linux (x86_64)

```bash
curl -L https://github.com/whalesync/scratch-cli/releases/download/v0.1.0/scratchmd_0.1.0_linux_amd64.tar.gz | tar xz
sudo mv scratchmd /usr/local/bin/
```

### Linux (ARM64)

```bash
curl -L https://github.com/whalesync/scratch-cli/releases/download/v0.1.0/scratchmd_0.1.0_linux_arm64.tar.gz | tar xz
sudo mv scratchmd /usr/local/bin/
```

### Windows

1. Download the zip file from [Releases](https://github.com/whalesync/scratch-cli/releases/tag/v0.1.0):
   - `scratchmd_0.1.0_windows_amd64.zip` (Standard 64-bit)
   - `scratchmd_0.1.0_windows_arm64.zip` (ARM64)
2. Extract the zip.
3. Open PowerShell/Command Prompt in that folder or add `scratchmd.exe` to your PATH.

---

## Getting Started

1. **Setup:**

   ```bash
   scratchmd setup
   ```

2. **Or Add Account manually:**

   ```bash
   scratchmd account add my-site --provider=webflow --api-key=YOUR_KEY
   ```

3. **Check Version:**
   ```bash
   scratchmd --version
   ```
