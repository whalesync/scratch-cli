# scratchmd CLI (TEST)

Test build pointing to `test-api.scratch.md`. For internal testing only.

## Installation

### Homebrew (macOS, Linux)

```bash
brew tap whalesync/scratch-cli-test
brew install scratchmd
```

### Scoop (Windows)

```powershell
scoop bucket add whalesync-test https://github.com/whalesync/scratch-cli-bucket-test
scoop install scratchmd
```

## Switching Between Test and Prod

If you have **both** taps/buckets installed, Homebrew/Scoop may get confused.

### Homebrew

```bash
# Uninstall current
brew uninstall scratchmd

# Switch to test
brew install whalesync/scratch-cli-test/scratchmd

# Switch to prod
brew install whalesync/scratch-cli/scratchmd
```

### Scoop

```powershell
# Uninstall current
scoop uninstall scratchmd

# Switch to test
scoop install whalesync-test/scratchmd

# Switch to prod
scoop install whalesync/scratchmd
```

## Verify

```bash
scratchmd --version
# Should show version ending in "-test" for test builds
```
