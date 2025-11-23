import { Injectable } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import { AnyTableSpec } from 'src/remote-service/connectors/library/custom-spec-registry';
import type { WorkbookId } from 'src/types/ids';
import { UploadType } from 'src/uploads/types';
import { UploadsDbService } from 'src/uploads/uploads-db.service';
import { Actor } from 'src/users/types';
import { SnapshotDbService } from 'src/workbook/snapshot-db.service';
import { WorkbookService } from 'src/workbook/workbook.service';
import { RecordMentionEntity, ResourceMentionEntity } from './entities/mentions.entity';

type SearchInput = { text: string; workbookId: WorkbookId; actor: Actor; tableId?: string };

@Injectable()
export class MentionsService {
  constructor(
    private readonly uploadsDbService: UploadsDbService,
    private readonly db: DbService,
    private readonly snapshotService: WorkbookService,
    private readonly snapshotDbService: SnapshotDbService,
  ) {}

  async searchMentions(input: SearchInput): Promise<{
    resources: { id: string; title: string; preview: string }[];
    records: { id: string; title: string; tableId: string }[];
  }> {
    const { text, workbookId, actor, tableId } = input;
    const queryText = (text || '').trim();

    const [resources, records] = await Promise.all([
      this.searchResources({ actor, queryText }),
      this.searchRecords({ workbookId, actor, queryText, tableId }),
    ]);

    return { resources, records };
  }

  async searchResources({ actor, queryText }: { actor: Actor; queryText: string }): Promise<ResourceMentionEntity[]> {
    const schemaName = this.uploadsDbService.getUploadSchemaName(actor);

    // First, search the Uploads table by name using Prisma
    const uploads = await this.db.client.upload.findMany({
      where: {
        userId: actor.userId,
        name: {
          contains: queryText,
          mode: 'insensitive',
        },
        type: UploadType.MD,
      },
      select: {
        id: true,
        name: true,
        typeId: true,
      },
      take: 10,
    });

    if (uploads.length === 0) {
      return [];
    }
    const mdUploadIds = uploads.map((upload) => upload.typeId);
    // Then load the full data from MdUploads by the found IDs
    const rows = (await this.uploadsDbService
      .getKnex()('MdUploads')
      .withSchema(schemaName)
      .select({ id: 'id' })
      .select({ PAGE_CONTENT: 'PAGE_CONTENT' })
      .whereIn('id', mdUploadIds)) as { id: string; PAGE_CONTENT: string }[];

    // Create a map of typeId to upload for easy lookup
    const uploadMap = new Map(uploads.map((upload) => [upload.typeId, upload]));

    return rows
      .map((r) => {
        const upload = uploadMap.get(r.id);
        if (!upload) return null;

        const content: string = r.PAGE_CONTENT || '';
        // Get first 20 characters of content for preview
        const contentPreview = content.replace(/\n/g, ' ').trim().substring(0, 20);
        const preview = contentPreview.length === 20 ? `${contentPreview}...` : contentPreview;

        return {
          id: upload.id, // Use Upload.id instead of typeId
          title: upload.name,
          preview: preview,
        };
      })
      .filter((r) => r !== null);
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
        .select({ id: 'wsId' })
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
