import { SnapshotTableId, WorkbookId } from '@spinner/shared-types';
import { useParams } from 'next/navigation';

export type FileViewType = 'files' | 'review';

export function useWorkbookParams() {
  const params = useParams();

  // Normalize slug to array
  const slugArray = Array.isArray(params.slug) ? params.slug : params.slug ? [params.slug] : [];

  const workbookId = slugArray[0] as WorkbookId;

  // URL structure: /workbooks/{workbookId}/{viewType}/{filePath...}
  // viewType can be 'files', 'review', or a tableId/dataFolderId
  const secondSegment = slugArray[1];
  const isFileView = secondSegment === 'files' || secondSegment === 'review';

  if (isFileView) {
    const viewType = secondSegment as FileViewType;
    const filePath = slugArray.slice(2).join('/') || undefined;

    return {
      workbookId,
      tableId: undefined as SnapshotTableId | undefined,
      recordId: undefined as string | undefined,
      columnId: undefined as string | undefined,
      workbookMode: 'files' as const,
      viewType,
      filePath,
    };
  }

  // Table/folder page params: /workbooks/{workbookId}/{tableId}/{recordId}/{columnId}
  const tableId = slugArray[1] as SnapshotTableId | undefined;
  const recordId = slugArray[2] as string | undefined;
  const columnId = slugArray[3] as string | undefined;

  return {
    workbookId,
    tableId,
    recordId,
    columnId,
    workbookMode: 'scratchsync' as const,
    viewType: undefined as FileViewType | undefined,
    filePath: undefined as string | undefined,
  };
}
