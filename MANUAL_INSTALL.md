# Manual Installation

For cases where Homebrew or Scoop are not available.

## Windows

### PowerShell One-Liner

```powershell
powershell -c "irm https://github.com/whalesync/scratch-cli/releases/latest/download/scratchmd_windows_amd64.zip -OutFile scratchmd.zip; Expand-Archive scratchmd.zip -DestinationPath C:\scratchmd; [Environment]::SetEnvironmentVariable('Path', $env:Path + ';C:\scratchmd', [EnvironmentVariableTarget]::User)"
```

### Manual Download

1. Download the zip file from [Latest Release](https://github.com/whalesync/scratch-cli/releases/latest):
   - `scratchmd_windows_amd64.zip` (Standard 64-bit)
   - `scratchmd_windows_arm64.zip` (ARM64)
2. Extract the zip.
3. Open PowerShell/Command Prompt in that folder or add `scratchmd.exe` to your PATH.

## macOS

### Apple Silicon (M1-M4)

```bash
curl -L https://github.com/whalesync/scratch-cli/releases/latest/download/scratchmd_darwin_arm64.tar.gz | tar xz
sudo mv scratchmd /usr/local/bin/
```

### Intel

```bash
curl -L https://github.com/whalesync/scratch-cli/releases/latest/download/scratchmd_darwin_amd64.tar.gz | tar xz
sudo mv scratchmd /usr/local/bin/
```

## Linux

### x86_64

```bash
curl -L https://github.com/whalesync/scratch-cli/releases/latest/download/scratchmd_linux_amd64.tar.gz | tar xz
sudo mv scratchmd /usr/local/bin/
```

### ARM64

```bash
curl -L https://github.com/whalesync/scratch-cli/releases/latest/download/scratchmd_linux_arm64.tar.gz | tar xz
sudo mv scratchmd /usr/local/bin/
```
