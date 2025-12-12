import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Logger,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { SnapshotTable } from '@prisma/client';
import type {
  AvailableMigrationsResponse,
  MigrationResult,
  RunMigrationDto,
  SnapshotTableId,
  ValidatedRunMigrationDto,
} from '@spinner/shared-types';
import { hasAdminToolsPermission } from 'src/auth/permissions';
import { AnyTableSpec } from 'src/remote-service/connectors/library/custom-spec-registry';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import type { RequestWithUser } from '../auth/types';
import { DbService } from '../db/db.service';
import { sanitizeForTableWsId } from '../remote-service/connectors/ids';
import { SnapshotDbService } from '../workbook/snapshot-db.service';

const AVAILABLE_MIGRATIONS = ['snapshot_table_v0_to_v1'];

@Controller('code-migrations')
@UseGuards(ScratchpadAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class CodeMigrationsController {
  private readonly logger = new Logger(CodeMigrationsController.name);

  constructor(
    private readonly db: DbService,
    private readonly snapshotDbService: SnapshotDbService,
  ) {}

  @Get('available')
  getAvailableMigrations(@Req() req: RequestWithUser): AvailableMigrationsResponse {
    if (!hasAdminToolsPermission(req.user)) {
      throw new UnauthorizedException('Only admins can access migrations');
    }

    return { migrations: AVAILABLE_MIGRATIONS };
  }

  @Post('run')
  async runMigration(@Req() req: RequestWithUser, @Body() dtoParam: RunMigrationDto): Promise<MigrationResult> {
    const dto = dtoParam as ValidatedRunMigrationDto;
    if (!hasAdminToolsPermission(req.user)) {
      throw new UnauthorizedException('Only admins can run migrations');
    }

    // Validate that either qty or ids is provided, but not both
    if (dto.qty && dto.ids && dto.ids.length > 0) {
      throw new BadRequestException('Cannot provide both qty and ids. Choose one.');
    }

    if (!dto.qty && (!dto.ids || dto.ids.length === 0)) {
      throw new BadRequestException('Must provide either qty or ids.');
    }

    switch (dto.migration) {
      case 'snapshot_table_v0_to_v1':
        return this.migrateSnapshotTableV0ToV1(dto.qty, dto.ids);
      default:
        throw new BadRequestException(`Unknown migration: ${dto.migration}`);
    }
  }

  /**
   * Migrates snapshot tables from v0 to v1 naming scheme.
   * v0: tableName = wsId (e.g., "my_table")
   * v1: tableName = {id}_{wsId} (e.g., "snt_abc123_my_table")
   */
  private async migrateSnapshotTableV0ToV1(qty?: number, ids?: string[]): Promise<MigrationResult> {
    // Fetch tables to migrate
    const tablesToMigrate = await this.fetchV0Tables(qty, ids);

    if (tablesToMigrate.length === 0) {
      this.logger.log('No v0 tables to migrate');
      const remainingCount = await this.db.client.snapshotTable.count({
        where: { version: 'v0' },
      });
      return {
        migratedIds: [],
        remainingCount,
        migrationName: 'snapshot_table_v0_to_v1',
      };
    }

    this.logger.log(`Migrating ${tablesToMigrate.length} tables from v0 to v1`);

    const migratedIds: string[] = [];

    for (const snapshotTable of tablesToMigrate) {
      try {
        await this.migrateTableV0ToV1(snapshotTable as never as SnapshotTable);
        migratedIds.push(snapshotTable.id);
        this.logger.log(
          `✅ Migrated table ${snapshotTable.id}: "${snapshotTable.tableName}" -> "${snapshotTable.id}_${snapshotTable.tableName}"`,
        );
      } catch (error) {
        this.logger.error(
          `❌ Failed to migrate table ${snapshotTable.id}: ${(error as Error).message}`,
          (error as Error).stack,
        );
        // Continue with other tables even if one fails
      }
    }

    // Count remaining v0 tables
    const remainingCount = await this.db.client.snapshotTable.count({
      where: { version: 'v0' },
    });

    this.logger.log(`Migration complete. Migrated: ${migratedIds.length}, Remaining v0 tables: ${remainingCount}`);

    return {
      migratedIds,
      remainingCount,
      migrationName: 'snapshot_table_v0_to_v1',
    };
  }

  private async fetchV0Tables(qty?: number, ids?: string[]) {
    if (ids && ids.length > 0) {
      return this.db.client.snapshotTable.findMany({
        where: {
          id: { in: ids },
          version: 'v0',
        },
      });
    } else if (qty) {
      return this.db.client.snapshotTable.findMany({
        where: { version: 'v0' },
        take: qty,
      });
    }

    return [];
  }

  private async migrateTableV0ToV1(table: SnapshotTable) {
    const tableId = table.id as SnapshotTableId;
    const workbookId = table.workbookId;
    const oldTableName = table.tableName;

    // Extract wsId from tableSpec for backwards compatibility
    const wsIdFromSpec = (table.tableSpec as AnyTableSpec).id.wsId;

    if (!oldTableName) {
      throw new Error(`Table ${tableId} has empty tableName. Cannot migrate.`);
    }

    // Generate new v1 table name: {id}_{sanitized_wsId}
    const sanitizedWsId = sanitizeForTableWsId(wsIdFromSpec);
    const newTableName = `${tableId}_${sanitizedWsId}`;

    // Check if old table exists in the snapshot schema
    const oldTableExists = await this.snapshotDbService.snapshotDb
      .getKnex()
      .schema.withSchema(workbookId)
      .hasTable(oldTableName);

    if (!oldTableExists) {
      this.logger.warn(`Table ${oldTableName} does not exist in schema ${workbookId}. Skipping rename.`);
    } else {
      // Check if new table name already exists (to avoid conflicts)
      const newTableExists = await this.snapshotDbService.snapshotDb
        .getKnex()
        .schema.withSchema(workbookId)
        .hasTable(newTableName);

      if (newTableExists) {
        throw new Error(`Target table ${newTableName} already exists in schema ${workbookId}. Cannot migrate.`);
      }

      // Rename the table in PostgreSQL
      await this.snapshotDbService.snapshotDb
        .getKnex()
        .raw(`ALTER TABLE "${workbookId}"."${oldTableName}" RENAME TO "${newTableName}"`);

      this.logger.log(`Renamed table in schema ${workbookId}: ${oldTableName} -> ${newTableName}`);
    }

    // Update the SnapshotTable record
    await this.db.client.snapshotTable.update({
      where: { id: tableId },
      data: {
        tableName: newTableName,
        version: 'v1',
      },
    });
  }
}
