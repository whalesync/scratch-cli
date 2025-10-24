/**
 * Dry-run script for the snapshot-to-snapshot-tables migration
 * This safely previews what data will be migrated without modifying anything
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function runDryRun() {
  console.log('🔍 Running migration dry-run...\n');

  try {
    // Read the dry-run SQL file
    const sqlPath = path.join(
      __dirname,
      '../prisma/migrations/20251024174311_migrate_snapshot_to_snapshot_tables/dry_run.sql',
    );
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // Split into individual statements (Prisma executeRaw doesn't support multiple statements)
    // So we'll run them one by one
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('/*') && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        const result = await prisma.$queryRawUnsafe(statement);
        console.log(result);
        console.log('---\n');
      } catch (error) {
        // Some SELECT statements might not return results in the expected format
        // That's okay - the output is what matters
        if (error instanceof Error && !error.message.includes('Empty query')) {
          console.error('Error executing statement:', error.message);
        }
      }
    }

    console.log('✅ Dry-run completed successfully');
  } catch (error) {
    console.error('❌ Error running dry-run:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runDryRun();
