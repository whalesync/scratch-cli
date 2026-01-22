# scratchmd-test CLI (TEST)

Test build pointing to `test-api.scratch.md`. For internal testing only.

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

## Coexistence with Production

The test binary is named `scratchmd-test` so it can coexist with the production `scratchmd`.

```bash
# Production
scratchmd --version

# Test
scratchmd-test --version
```

## Verify

```bash
scratchmd-test --version
# The binary connects to test-api.scratch.md
```
