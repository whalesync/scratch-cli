import { Injectable } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import { AnyTableSpec } from 'src/remote-service/connectors/library/custom-spec-registry';
import { SnapshotDbService } from 'src/snapshot/snapshot-db.service';
import { SnapshotService } from 'src/snapshot/snapshot.service';
import { SnapshotId } from 'src/types/ids';
import { UploadType } from 'src/uploads/types';
import { UploadsDbService } from 'src/uploads/uploads-db.service';
import { RecordMentionEntity, ResourceMentionEntity } from './types';

type SearchInput = { text: string; snapshotId: SnapshotId; userId: string; tableId?: string };

@Injectable()
export class MentionsService {
  constructor(
    private readonly uploadsDbService: UploadsDbService,
    private readonly db: DbService,
    private readonly snapshotService: SnapshotService,
    private readonly snapshotDbService: SnapshotDbService,
  ) {}

  async searchMentions(input: SearchInput): Promise<{
    resources: { id: string; title: string; preview: string }[];
    records: { id: string; title: string; tableId: string }[];
  }> {
    const { text, snapshotId, userId, tableId } = input;
    const queryText = (text || '').trim();

    const [resources, records] = await Promise.all([
      this.searchResources({ userId, queryText }),
      this.searchRecords({ snapshotId, userId, queryText, tableId }),
    ]);

    return { resources, records };
  }

  async searchResources({
    userId,
    queryText,
  }: {
    userId: string;
    queryText: string;
  }): Promise<ResourceMentionEntity[]> {
    const schemaName = this.uploadsDbService.getUserUploadSchema(userId);

    // First, search the Uploads table by name using Prisma
    const uploads = await this.db.client.upload.findMany({
      where: {
        userId,
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
      .knex('MdUploads')
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
    snapshotId,
    userId,
    queryText,
    tableId,
  }: {
    snapshotId: SnapshotId;
    userId: string;
    queryText: string;
    tableId?: string;
  }): Promise<RecordMentionEntity[]> {
    if (!tableId) {
      return [];
    }

    const snapshot = await this.snapshotService.findOne(snapshotId, userId);
    if (!snapshot) return [];

    // Find the table by tableId using tableSpecs
    const tableSpecs = snapshot.tableSpecs as AnyTableSpec[];
    const table = tableSpecs.find((t) => t.id.wsId === tableId);
    if (!table) return [];

    // Check if table has a title column
    const titleColWsId = table.titleColumnRemoteId?.[0];
    if (!titleColWsId) return [];

    try {
      // Search records in the table using the title column
      const rows = await this.snapshotDbService.snapshotDb
        .knex(`${snapshotId}.${table.id.wsId}`)
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
            tableId: table.id.wsId,
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
