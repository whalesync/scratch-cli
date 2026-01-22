#!/bin/bash
set -e
# Ensure we are in the scratch-cli directory (project root) regardless of where script is called from
cd "$(dirname "$0")/.."

# Usage: ./release_test.sh [patch|minor|major]

RELEASE_TYPE=$1
GITHUB_REPO_URL="https://github.com/whalesync/scratch-cli.git"
GITHUB_AUTH_URL="https://${GITHUB_TOKEN}@github.com/whalesync/scratch-cli.git"

# Validate input
if [[ "$RELEASE_TYPE" != "patch" && "$RELEASE_TYPE" != "minor" && "$RELEASE_TYPE" != "major" ]]; then
  echo "Usage: $0 [patch|minor|major]"
  exit 1
fi

echo "🚀 Starting TEST release process ($RELEASE_TYPE)..."

# Configure git
git config --global user.email "ci@whalesync.com"
git config --global user.name "GitLab CI"
git fetch --tags

# 1. Find latest PRODUCTION tag (cli-X.Y.Z) to base off of
# Sort by version: 'v:refname' sorts semantically (cli-0.1.9 < cli-0.1.10)
LATEST_TAG=$(git tag -l "cli-*" --sort=-v:refname | head -n1)

if [ -z "$LATEST_TAG" ]; then
  # Fallback if no tags exist yet (unlikely in real scenario)
  LATEST_TAG="cli-0.0.0"
fi
echo "Latest PRODUCTION tag found: $LATEST_TAG"

# Extract version numbers (removes 'cli-' prefix)
VERSION=${LATEST_TAG#cli-}
IFS='.' read -r MAJOR MINOR PATCH <<< "$VERSION"

# 2. Increment version to get the TARGET version
MAJOR_INC=0
MINOR_INC=0
PATCH_INC=0

if [ "$RELEASE_TYPE" == "major" ]; then MAJOR_INC=1; fi
if [ "$RELEASE_TYPE" == "minor" ]; then MINOR_INC=1; fi
if [ "$RELEASE_TYPE" == "patch" ]; then PATCH_INC=1; fi

if [ "$MAJOR_INC" -eq 1 ]; then
  MAJOR=$((MAJOR + 1))
  MINOR=0
  PATCH=0
fi
if [ "$MINOR_INC" -eq 1 ]; then
  MINOR=$((MINOR + 1))
  PATCH=0
fi
if [ "$PATCH_INC" -eq 1 ]; then
  PATCH=$((PATCH + 1))
fi

# The suffix for test releases
SUFFIX="-test"

NEW_VERSION="v$MAJOR.$MINOR.$PATCH$SUFFIX"
echo "🎯 Target Test Version: $NEW_VERSION"

# 3. Check if this tag already exists on remote
REMOTE_EXISTS=$(git ls-remote --tags "$GITHUB_REPO_URL" "refs/tags/$NEW_VERSION")

if [ -n "$REMOTE_EXISTS" ]; then
  echo "⚠️  Tag $NEW_VERSION already exists on remote. Cleaning up..."
  
  # 3a. Delete the GitHub Release first (to avoid orphaned Drafts)
  echo "Checking for existing GitHub Release for $NEW_VERSION..."
  # Fetch release info; assuming the first "id" field in the JSON is the Release ID is a common heuristic when jq isn't guaranteed.
  RELEASE_JSON=$(curl -s -H "Authorization: token $GITHUB_TOKEN" "https://api.github.com/repos/whalesync/scratch-cli/releases/tags/$NEW_VERSION")
  
  # Extract ID (simple grep/cut). The Release object ID is the first "id" field.
  RELEASE_ID=$(echo "$RELEASE_JSON" | grep -m 1 '"id":' | tr -d ' ",' | cut -d: -f2)
  
  if [ -n "$RELEASE_ID" ] && [ "$RELEASE_ID" != "null" ]; then
    echo "Found existing Release ID: $RELEASE_ID. Deleting..."
    curl -X DELETE -H "Authorization: token $GITHUB_TOKEN" \
      "https://api.github.com/repos/whalesync/scratch-cli/releases/$RELEASE_ID" || echo "Warning: Failed to delete release (continuing)"
  else
    echo "No existing GitHub release found for tag $NEW_VERSION."
  fi

  # 3b. Delete remote tag
  echo "Deleting remote tag $NEW_VERSION..."
  # use local git with auth token in URL if accessible, or curl
  # Since we are in CI, we usually use the auth URL
  git push --delete "$GITHUB_AUTH_URL" "$NEW_VERSION" || echo "Failed to delete tag via git push, might be protected or not found (ignoring)"

else
  echo "Tag $NEW_VERSION does not exist on remote. Proceeding."
fi

# 4. Create the local tag
# Determine the commit to tag (HEAD)
HEAD_SHA=$(git rev-parse HEAD)
echo "Tagging HEAD ($HEAD_SHA) as $NEW_VERSION..."
git tag -f "$NEW_VERSION"

# 5. Push the tag to GitHub
# We need to push the tag so goreleaser can see it exists on remote (it checks)
# and so homebrew/scoop can download from it.
echo "Pushing tag $NEW_VERSION to GitHub..."
git push -f "$GITHUB_AUTH_URL" "$NEW_VERSION"


# 6. Prepare for Goreleaser (Clean dependencies)
echo "Running go mod tidy..."
go mod tidy

# Check if repo is clean
if ! git diff --quiet go.mod go.sum 2>/dev/null; then
  echo "⚠️  Warning: go mod tidy modified go.mod or go.sum"
  echo "   Resetting go.mod and go.sum..."
  git checkout -- go.mod go.sum
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "❌ Error: Repository has uncommitted changes."
  git status --short
  exit 1
fi

# 7. Run Goreleaser with test config
echo "Running Goreleaser with .goreleaser-test.yaml..."
# GORELEASER_CURRENT_TAG env var tells goreleaser which tag to build for
export GORELEASER_CURRENT_TAG="$NEW_VERSION"
goreleaser release --clean --config .goreleaser-test.yaml

echo "✅ Test release $NEW_VERSION complete!"
