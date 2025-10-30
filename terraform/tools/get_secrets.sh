#!/bin/bash
set -uo pipefail

# First argument is the environment name
if [ $# -eq 0 ]; then
    echo "usage: $0 <environment>"
    exit 1
fi

secrets_file="$(dirname "$0")/../secrets.txt"

env="$1"
project_id="spv1-$env"

# Read secrets from secrets.txt, removing whitespace and ignoring blank lines
secret_ids=()
while IFS= read -r line; do
    trimmed_line=$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    if [ -n "$trimmed_line" ] && [[ ! "$trimmed_line" =~ ^# ]]; then
        secret_ids+=("$trimmed_line")
    fi
done < "$secrets_file"

# Track errors
error_count=0

# Output each secret as SECRET=VALUE
for secret in "${secret_ids[@]}"
do
  if value=$(gcloud secrets versions access latest --secret="$secret" --project="$project_id" 2>/dev/null); then
    echo "$secret=$value"
  else
    echo "$secret="
    ((error_count++))
  fi
done

# Output error count to stderr
if [ $error_count -gt 0 ]; then
  echo "Errors: $error_count secret(s) missing versions" >&2
fi
