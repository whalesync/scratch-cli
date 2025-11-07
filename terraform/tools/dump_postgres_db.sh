#!/bin/bash
set -eu -o pipefail

# Dumps a Postgres database including the public schema and all snapshot schemas
# Prerequisites:
#   - Ensure pg_dump is installed and in PATH
# To use:
#   1. Run this script with the connection string
#      > ./dump_postgres_db.sh postgresql://postgres:postgres@127.0.0.1:5432/postgres
#   2. The dump will be created in the current directory with timestamp

if [ $# -lt 1 ]; then
  echo "usage: $0 postgres://..."
  echo "You must provide the database URL as the first argument."
  exit 1
fi

DATABASE_URL="$1"

# Ensure required tools are installed
if ! command -v pg_dump &> /dev/null; then
    echo "pg_dump could not be found, please install PostgreSQL client tools."
    exit 1
fi

# Set output file
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="./db_dump_${TIMESTAMP}.sql"

echo "Starting database dump to: $OUTPUT_FILE"
echo ""

# Perform the dump with verbose output
if ! pg_dump \
  "${DATABASE_URL}" \
  --verbose \
  --data-only \
  --exclude-table-data=_prisma_migrations \
  --format=plain \
  --no-owner \
  --no-acl \
  --no-tablespaces \
  --no-comments \
  --no-security-labels \
  --no-subscriptions \
  --schema=public \
  > "$OUTPUT_FILE"; then
  echo "✗ Error: Database dump of public schema failed!"
  exit 1
fi

if ! pg_dump \
  "${DATABASE_URL}" \
  --verbose \
  --format=plain \
  --no-owner \
  --no-acl \
  --no-tablespaces \
  --no-comments \
  --no-security-labels \
  --no-subscriptions \
  --schema='sna_*' \
  >> "$OUTPUT_FILE"; then
  echo "✗ Error: Database dump of snapshot schemas failed!"
  exit 1
fi

if ! pg_dump \
  "${DATABASE_URL}" \
  --verbose \
  --format=plain \
  --no-owner \
  --no-acl \
  --no-tablespaces \
  --no-comments \
  --no-security-labels \
  --no-subscriptions \
  --schema='uploads_*' \
  >> "$OUTPUT_FILE"; then
  echo "✗ Error: Database dump of upload schemas failed!"
  exit 1
fi

FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
echo ""
echo "✓ Database dump completed successfully!"
echo "  Output file: $OUTPUT_FILE"
echo "  File size: $FILE_SIZE"
echo ""
echo "To load this dump into another database, use:"
echo "  $(dirname "$0")/load_postgres_db.sh $OUTPUT_FILE"
