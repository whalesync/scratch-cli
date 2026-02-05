#!/bin/bash
set -euo pipefail

# First argument is the environment name
if [ $# -eq 0 ]; then
    echo "usage: $0 <environment>"
    exit 1
fi

secrets_file="$(dirname "$0")/../secrets.txt"

env="$1"
project_id="spv1eu-$env"

# Read secrets from secrets.txt, removing whitespace and ignoring blank lines
secret_ids=()
while IFS= read -r line; do
    trimmed_line=$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    if [ -n "$trimmed_line" ]; then
        secret_ids+=("$trimmed_line")
    fi
done < "$secrets_file"

errors=0
for secret in "${secret_ids[@]}"
do
  echo "Checking secret $secret"
  if ! gcloud secrets versions access latest --secret="$secret" --project="$project_id" >/dev/null 2>&1; then
    echo "Error: Failed to get latest value for '$secret' in $project_id"
    ((errors++))
  fi
done

if [ $errors -gt 0 ]; then
  echo "Failed to access $errors secret(s)"
  exit 1
fi
