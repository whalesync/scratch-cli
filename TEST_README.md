# scratchmd-test CLI (TEST)

Test build pointing to `test-api.scratch.md`. For internal testing only.

The binary is named `scratchmd-test` so it can coexist with the production `scratchmd`.

## Installation

### Homebrew (macOS, Linux)

```bash
brew tap whalesync/scratch-cli-test
brew install scratchmd-test
```

### Scoop (Windows)

```powershell
scoop bucket add whalesync-test https://github.com/whalesync/scratch-cli-bucket-test
scoop install scratchmd-test
```

## Verify

```bash
scratchmd-test --version
```
