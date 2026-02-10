#!/bin/bash
set -euo pipefail

# Manual deployment script for Scratch production
# Usage: ./manual_deploy.sh

SECRETS_FILE="/tmp/prod-secrets.env"
GCP_PROJECT="spv1eu-production"
REGISTRY="europe-west1-docker.pkg.dev/$GCP_PROJECT/eu-production-registry"
REGION="europe-west1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Cleanup secrets file on exit (success or failure)
cleanup() {
  if [ -f "$SECRETS_FILE" ]; then
    rm -f "$SECRETS_FILE"
    echo "==> Cleaned up secrets file"
  fi
}
trap cleanup EXIT

# Helper to extract a secret value
get_secret() {
  grep "^$1=" "$SECRETS_FILE" | cut -d= -f2-
}

echo "==> Fetching secrets from GCP..."
"$SCRIPT_DIR/get_secrets.sh" production > "$SECRETS_FILE"

echo "==> Setting GCP project to $GCP_PROJECT..."
gcloud config set project "$GCP_PROJECT"

echo "==> Authenticating Docker with GCP..."
gcloud auth print-access-token | docker login -u oauth2accesstoken --password-stdin https://europe-west1-docker.pkg.dev

BUILD_VERSION=$(date +%y.%m.%d.%H.%M).$(git -C "$REPO_ROOT" rev-parse --short HEAD)
echo "==> Build version: $BUILD_VERSION"

echo "==> Building client image..."
docker build \
  --platform linux/amd64 \
  --build-arg APP_ENV=production \
  --build-arg BUILD_VERSION="$BUILD_VERSION" \
  --build-arg CLERK_PUBLISHABLE_KEY="$(get_secret CLERK_PUBLISHABLE_KEY)" \
  --build-arg NEXT_PUBLIC_POSTHOG_KEY="$(get_secret POSTHOG_API_KEY)" \
  --build-arg NEXT_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com" \
  --build-arg NEXT_PUBLIC_API_URL=https://api.scratch.md \
  -t "$REGISTRY/spinner-client:latest" \
  -f "$REPO_ROOT/client/Dockerfile.monorepo" \
  "$REPO_ROOT"

echo "==> Building server image..."
docker build \
  --platform linux/amd64 \
  --build-arg BUILD_VERSION="$BUILD_VERSION" \
  -t "$REGISTRY/spinner-server:latest" \
  -f "$REPO_ROOT/server/Dockerfile.monorepo" \
  "$REPO_ROOT"

echo "==> Pushing images..."
docker push "$REGISTRY/spinner-client:latest"
docker push "$REGISTRY/spinner-server:latest"

echo "==> Deploying client-service..."
gcloud run services update client-service \
  --image="$REGISTRY/spinner-client:latest" \
  --region "$REGION" \
  --project "$GCP_PROJECT"

echo "==> Deploying api-service..."
gcloud run services update api-service \
  --image="$REGISTRY/spinner-server:latest" \
  --region "$REGION" \
  --project "$GCP_PROJECT"

echo "==> Done! Deployment complete."
echo "Client: https://app.scratch.md/"
echo "API: https://api.scratch.md/"
