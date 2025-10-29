#!/bin/bash
set -euo pipefail

# First argument is the secret name
if [ $# -ne 1 ]; then
    echo "usage: $0 <secret_name>"
    exit 1
fi

if ! git diff --cached --exit-code --compact-summary; then
    echo "Error: There are uncommitted and staged changes in the repository."
    echo "Commit or git reset the changes and run this script again."
    exit 1
fi

name="$1"
secrets_file=$(realpath "$(dirname "$0")/../secrets.txt")

# Check if the secret name already exists in the secrets file
if grep -q "^$name$" "$secrets_file"; then
    echo "Error: Secret '$name' already exists in $secrets_file"
    exit 1
fi

echo >> "$secrets_file"
echo "$name" >> "$secrets_file"

# sort the secrets file
sort "$secrets_file" -o "$secrets_file"

# delete any blank lines
awk 'NF' "$secrets_file" > "${secrets_file}.tmp" && mv "${secrets_file}.tmp" "$secrets_file"

PAGER='' git diff "$secrets_file"

git add "$secrets_file"
git commit -m "Added secret $name"

# Confirm before doing a targeted terraform apply
read -p "Do you want to apply this locally with Terraform? [y/N] " -r
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
fi

for env in test staging production; do
    pushd "$(dirname "$0")/../envs/$env"
    terraform apply --target "module.$env.google_secret_manager_secret.required"
    popd
done