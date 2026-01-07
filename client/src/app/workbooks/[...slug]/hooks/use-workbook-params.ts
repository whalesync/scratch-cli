import { RouteUrls } from '@/utils/route-urls';
import { SnapshotTableId, WorkbookId } from '@spinner/shared-types';
import { useParams, usePathname } from 'next/navigation';

export function useWorkbookParams() {
  const params = useParams();
  const pathname = usePathname();
  // the path could have 0, 1, or 2 parts
  // 3 parts: /workbooks/{workbookId}/{tableId}/{recordId}/{columnId}

  const workbookMode = RouteUrls.isWorkbookFilePage(pathname) ? 'files' : 'tables';

  const workbookId = params.slug?.[0] as WorkbookId;
  const tableId = params.slug?.[1] as SnapshotTableId | undefined;
  const recordId = params.slug?.[2] as string | undefined;
  const columnId = params.slug?.[3] as string | undefined;

  return { workbookId, tableId, recordId, columnId, workbookMode };
}
