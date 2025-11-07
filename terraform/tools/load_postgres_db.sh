#!/bin/bash
set -eu -o pipefail

# Loads a Postgres database dump into a target database
# Prerequisites:
#   - Ensure psql is installed and in PATH
#   - Have a dump file created by dump_postgres_db.sh
# To use:
#   1. Run this script with the path to the dump file and the connection string for the destination
#      > ./load_postgres_db.sh <path to dump.sql> postgresql://postgres:postgres@127.0.0.1:5432/postgres
#   2. The script will load the dump into the target database

if [ $# -lt 2 ]; then
  echo "usage: $0 <dump_file> <database connection string>"
  exit 1
fi

if ! command -v psql &> /dev/null; then
    echo "psql could not be found, please install PostgreSQL client tools."
    exit 1
fi

DUMP_FILE="$1"
DATABASE_URL="$2"

# Check if dump file exists
if [ ! -f "$DUMP_FILE" ]; then
    echo "Error: Dump file not found: $DUMP_FILE"
    exit 1
fi

echo "Dump file: $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))"
echo ""

# Check if we can connect to the database
echo "Testing database connection..."
if ! psql "${DATABASE_URL}" -q -t -c "SELECT 'success';"; then
    echo "Error: Could not connect to database"
    exit 1
fi
echo ""

# Final confirmation
read -r -p "Continue with database load? (yes/no): " confirmation
if [[ "$confirmation" != "yes" ]]; then
    echo "Aborted."
    exit 0
fi
echo ""

echo "Loading database dump..."
echo ""

# Load the dump
# Options:
#   --single-transaction: Execute as a single transaction (safer)
#   --set ON_ERROR_STOP=on: Stop on first error
if psql \
  "${DATABASE_URL}" \
  --single-transaction \
  --set ON_ERROR_STOP=on \
  -f "$DUMP_FILE"; then

  echo ""
  echo "✓ Database load completed successfully!"
  echo ""
else
  echo ""
  echo "✗ Error: Database load failed!"
  echo "The transaction was rolled back, database state unchanged."
  exit 1
fi
