#!/bin/bash
# Enable error tracing
set -x

# Resolve absolute path to repos
export GIT_PROJECT_ROOT=$(pwd)/repos
export GIT_HTTP_EXPORT_ALL=1
export PATH_INFO=/test-repo.git/info/refs
export QUERY_STRING=service=git-upload-pack
export REQUEST_METHOD=GET
export REMOTE_USER=test
export CONTENT_TYPE=application/x-git-upload-pack-request

echo "=== Environment ==="
echo "GIT_PROJECT_ROOT: $GIT_PROJECT_ROOT"
echo "PATH_INFO: $PATH_INFO"
echo "==================="

# Run git http-backend and capture output
git http-backend
