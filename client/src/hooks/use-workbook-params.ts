import { DataFolderId, WorkbookId } from '@spinner/shared-types';
import { useParams } from 'next/navigation';

export type FileViewType = 'files' | 'review';

export function useWorkbookParams() {
  const params = useParams();

  // Normalize slug to array
  const slugArray = Array.isArray(params.slug) ? params.slug : params.slug ? [params.slug] : [];

  const workbookId = slugArray[0] as WorkbookId;

  // URL structure: /workbook/{workbookId}/{viewType}/{filePath...}
  // viewType can be 'files', 'review', or a dataFolderId
  const secondSegment = slugArray[1];
  const isFileView = secondSegment === 'files' || secondSegment === 'review';

  if (isFileView) {
    const viewType = secondSegment as FileViewType;
    const filePath = slugArray.slice(2).join('/') || undefined;

    return {
      workbookId,
      dataFolderId: undefined as DataFolderId | undefined,
      viewType,
      filePath,
    };
  }

  // Table/folder page params: /workbook/{workbookId}/{dataFolderId}/{recordId}/{columnId}
  const dataFolderId = slugArray[1] as DataFolderId | undefined;

  return {
    workbookId,
    dataFolderId,
    viewType: undefined as FileViewType | undefined,
    filePath: undefined as string | undefined,
  };
}
