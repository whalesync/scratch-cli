#!/bin/bash
set -e
# Ensure we are in the scratch-cli directory (project root) regardless of where script is called from
cd "$(dirname "$0")/.."

# Usage: ./release_public.sh [patch|minor|major]

RELEASE_TYPE=$1
GITHUB_REPO_URL="https://github.com/whalesync/scratch-cli.git"
GITHUB_AUTH_URL="https://${GITHUB_TOKEN}@github.com/whalesync/scratch-cli.git"

# Validate input
if [[ "$RELEASE_TYPE" != "patch" && "$RELEASE_TYPE" != "minor" && "$RELEASE_TYPE" != "major" ]]; then
  echo "Usage: $0 [patch|minor|major]"
  exit 1
fi

echo "🚀 Starting release process ($RELEASE_TYPE)..."

# Configure git
git config --global user.email "ci@whalesync.com"
git config --global user.name "GitLab CI"
git fetch --tags

# 1. Find latest cli-X.Y.Z tag
# Sort by version: 'v:refname' sorts semantically (cli-0.1.9 < cli-0.1.10)
LATEST_TAG=$(git tag -l "cli-*" --sort=-v:refname | head -n1)

if [ -z "$LATEST_TAG" ]; then
  LATEST_TAG="cli-0.2.3"
fi
echo "Latest tag found: $LATEST_TAG"

# Extract version numbers (removes 'cli-' prefix)
VERSION=${LATEST_TAG#cli-}
IFS='.' read -r MAJOR MINOR PATCH <<< "$VERSION"

# 2. Increment version
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

NEW_VERSION="v$MAJOR.$MINOR.$PATCH"
CLI_TAG="cli-$MAJOR.$MINOR.$PATCH"
echo "🎯 Target Version: $NEW_VERSION (Internal: $CLI_TAG)"

# 3. Create the temporary local tag (vX.Y.Z) for GoReleaser
git tag $NEW_VERSION

# 4. Create tag on Remote GitHub via API (avoids fetching history)
echo "Fetching remote HEAD SHA from GitHub..."
REMOTE_SHA=$(git ls-remote "$GITHUB_REPO_URL" HEAD | awk '{ print $1 }')
echo "Creating tag $NEW_VERSION on GitHub commit $REMOTE_SHA via API..."

curl -X POST -H "Authorization: token $GITHUB_TOKEN" \
     -H "Accept: application/vnd.github.v3+json" \
     "https://api.github.com/repos/whalesync/scratch-cli/git/refs" \
     -d "{\"ref\": \"refs/tags/$NEW_VERSION\", \"sha\": \"$REMOTE_SHA\"}"

# 5. Run Goreleaser
goreleaser release --clean

# 6. Tag GitLab with proper cli-X.Y.Z tag to save state for next time
echo "Labeling current commit with $CLI_TAG..."
git tag "$CLI_TAG"

# Push tag using CICD_ACCESS_TOKEN
if [ -z "$CICD_ACCESS_TOKEN" ]; then
  echo "❌ Error: CICD_ACCESS_TOKEN is required for internal tagging."
  exit 1
fi
git push "https://oauth2:${CICD_ACCESS_TOKEN}@${CI_SERVER_HOST}/${CI_PROJECT_PATH}.git" "$CLI_TAG"
