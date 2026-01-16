# scratchmd CLI

Sync local Markdown files with your CMS (Webflow, WordPress, and more).

## Installation

### Homebrew (macOS, Linux, WSL)

The recommended way to install on macOS and Linux.

```bash
brew tap whalesync/tap
brew install scratchmd
```

### Windows

**Option 1: Scoop (Recommended)**

```powershell
scoop bucket add whalesync https://github.com/whalesync/scratch-cli-bucket
scoop install scratchmd
```

**Option 2: PowerShell One-Liner**

```powershell
powershell -c "irm https://github.com/whalesync/scratch-cli/releases/latest/download/scratchmd_windows_amd64.zip -OutFile scratchmd.zip; Expand-Archive scratchmd.zip -DestinationPath C:\scratchmd; [Environment]::SetEnvironmentVariable('Path', $env:Path + ';C:\scratchmd', [EnvironmentVariableTarget]::User)"
```

**Option 3: Manual Download**

1. Download the zip file from [Latest Release](https://github.com/whalesync/scratch-cli/releases/latest):
   - `scratchmd_windows_amd64.zip` (Standard 64-bit)
   - `scratchmd_windows_arm64.zip` (ARM64)
2. Extract the zip.
3. Open PowerShell/Command Prompt in that folder or add `scratchmd.exe` to your PATH.

### Manual Download (Linux / macOS)

### macOS (Apple Silicon / M1-M3):\*\*

```bash
curl -L https://github.com/whalesync/scratch-cli/releases/latest/download/scratchmd_darwin_arm64.tar.gz | tar xz
sudo mv scratchmd /usr/local/bin/
```

**macOS (Intel):**

```bash
curl -L https://github.com/whalesync/scratch-cli/releases/latest/download/scratchmd_darwin_amd64.tar.gz | tar xz
sudo mv scratchmd /usr/local/bin/
```

**Linux (x86_64):**

```bash
curl -L https://github.com/whalesync/scratch-cli/releases/latest/download/scratchmd_linux_amd64.tar.gz | tar xz
sudo mv scratchmd /usr/local/bin/
```

**Linux (ARM64):**

```bash
curl -L https://github.com/whalesync/scratch-cli/releases/latest/download/scratchmd_linux_arm64.tar.gz | tar xz
sudo mv scratchmd /usr/local/bin/
```

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
