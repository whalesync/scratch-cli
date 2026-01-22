#!/bin/bash
# Install scratchmd-local to GOPATH/bin
set -e
cd "$(dirname "$0")"

echo "Building scratchmd-local..."
go build -o "$(go env GOPATH)/bin/scratchmd-local" ./cmd/scratchmd

echo "✅ Installed scratchmd-local to $(go env GOPATH)/bin/"
echo "Run: scratchmd-local --version"
