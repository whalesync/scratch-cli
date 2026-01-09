import { Injectable } from '@nestjs/common';
import { SCRATCH_ID_COLUMN, type WorkbookId } from '@spinner/shared-types';
import { AnyTableSpec } from 'src/remote-service/connectors/library/custom-spec-registry';
import { Actor } from 'src/users/types';
import { SnapshotDbService } from 'src/workbook/snapshot-db.service';
import { WorkbookService } from 'src/workbook/workbook.service';
import { RecordMentionEntity } from './entities/mentions.entity';

type SearchInput = { text: string; workbookId: WorkbookId; actor: Actor; tableId?: string };

@Injectable()
export class MentionsService {
  constructor(
    private readonly snapshotService: WorkbookService,
    private readonly snapshotDbService: SnapshotDbService,
  ) {}

  async searchMentions(input: SearchInput): Promise<{
    resources: { id: string; title: string; preview: string }[];
    records: { id: string; title: string; tableId: string }[];
  }> {
    const { workbookId, actor, tableId, text } = input;
    const queryText = (text || '').trim();

    const records = await this.searchRecords({ workbookId, actor, queryText, tableId });

    // Resources (uploaded markdown documents) are no longer supported
    return { resources: [], records };
  }

  async searchRecords({
    workbookId,
    actor,
    queryText,
    tableId,
  }: {
    workbookId: WorkbookId;
    actor: Actor;
    queryText: string;
    tableId?: string;
  }): Promise<RecordMentionEntity[]> {
    if (!tableId) {
      return [];
    }

    const snapshot = await this.snapshotService.findOne(workbookId, actor);
    if (!snapshot) return [];

    // Find the table by tableId
    const snapshotTable = snapshot.snapshotTables?.find((t) => t.id === tableId);
    if (!snapshotTable) return [];

    const table = snapshotTable.tableSpec as AnyTableSpec;

    // Check if table has a title column
    const titleColWsId = table.titleColumnRemoteId?.[0];
    if (!titleColWsId) return [];

    try {
      // Search records in the table using the title column
      const rows = await this.snapshotDbService.snapshotDb
        .getKnex()(`${workbookId}.${snapshotTable.tableName}`)
        .select(SCRATCH_ID_COLUMN)
        .select(titleColWsId)
        .whereILike(titleColWsId, `${queryText}%`)
        .limit(10);

      const results: RecordMentionEntity[] = [];
      for (const row of rows as { id: string; [key: string]: unknown }[]) {
        const title = row[titleColWsId] as string;
        if (title && typeof title === 'string') {
          results.push({
            id: row.id,
            title,
            tableId: snapshotTable.id,
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error searching records:', error);
      return [];
    }
  }
}
