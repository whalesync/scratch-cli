# Build Instructions for scratch-cli

This document explains how to build the `scratchmd` CLI for different platforms.

## Prerequisites

- **Go 1.21+** installed (check with `go version`)
- Clone the repository

## Quick Build (Current Platform)

```bash
# Build for your current OS/architecture
go build -o scratchmd ./cmd/scratchmd

# Run it
./scratchmd --help
```

## Build with Version Info

To embed version information into the binary:

```bash
VERSION=0.1.0
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SCRATCH_API_SERVER_URL="https://api.scratch.md"

go build -ldflags "-X 'github.com/whalesync/scratch-cli/internal/cmd.version=${VERSION}' \
                   -X 'github.com/whalesync/scratch-cli/internal/cmd.commit=${COMMIT}' \
                   -X 'github.com/whalesync/scratch-cli/internal/cmd.buildDate=${BUILD_DATE}' \
                   -X 'github.com/whalesync/scratch-cli/internal/api.DefaultScratchServerURL=${SCRATCH_API_SERVER_URL}'" \
         -o scratchmd ./cmd/scratchmd
```

## Cross-Platform Builds

Build for different operating systems and architectures:

### macOS (Apple Silicon)

```bash
GOOS=darwin GOARCH=arm64 go build -o scratchmd-darwin-arm64 ./cmd/scratchmd
```

### macOS (Intel)

```bash
GOOS=darwin GOARCH=amd64 go build -o scratchmd-darwin-amd64 ./cmd/scratchmd
```

### Linux (x86_64)

```bash
GOOS=linux GOARCH=amd64 go build -o scratchmd-linux-amd64 ./cmd/scratchmd
```

### Linux (ARM64)

```bash
GOOS=linux GOARCH=arm64 go build -o scratchmd-linux-arm64 ./cmd/scratchmd
```

### Windows (x86_64)

```bash
GOOS=windows GOARCH=amd64 go build -o scratchmd-windows-amd64.exe ./cmd/scratchmd
```

## Build All Platforms Script

Create a release build for all major platforms:

```bash
#!/bin/bash
set -e

VERSION=${1:-"dev"}
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

LDFLAGS="-X 'github.com/whalesync/scratch-cli/internal/cmd.version=${VERSION}' \
         -X 'github.com/whalesync/scratch-cli/internal/cmd.commit=${COMMIT}' \
         -X 'github.com/whalesync/scratch-cli/internal/cmd.buildDate=${BUILD_DATE}'"

mkdir -p dist

# macOS
GOOS=darwin GOARCH=arm64 go build -ldflags "$LDFLAGS" -o dist/scratchmd-darwin-arm64 ./cmd/scratchmd
GOOS=darwin GOARCH=amd64 go build -ldflags "$LDFLAGS" -o dist/scratchmd-darwin-amd64 ./cmd/scratchmd

# Linux
GOOS=linux GOARCH=amd64 go build -ldflags "$LDFLAGS" -o dist/scratchmd-linux-amd64 ./cmd/scratchmd
GOOS=linux GOARCH=arm64 go build -ldflags "$LDFLAGS" -o dist/scratchmd-linux-arm64 ./cmd/scratchmd

# Windows
GOOS=windows GOARCH=amd64 go build -ldflags "$LDFLAGS" -o dist/scratchmd-windows-amd64.exe ./cmd/scratchmd

echo "Build complete! Binaries in dist/"
ls -la dist/
```

## Development Build

For faster development iteration (skips optimizations):

```bash
go build -gcflags="all=-N -l" -o scratchmd ./cmd/scratchmd
```

## Install Globally

To install the binary to your `$GOPATH/bin`:

```bash
go install ./cmd/scratchmd
```

Make sure `$GOPATH/bin` is in your `$PATH`.

## Verify Build

After building, verify the binary works:

```bash
./scratchmd --version
./scratchmd --help
```
