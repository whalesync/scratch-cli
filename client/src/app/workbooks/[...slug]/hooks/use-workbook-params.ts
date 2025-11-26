import { RouteUrls } from '@/utils/route-urls';
import { SnapshotTableId, WorkbookId } from '@spinner/shared-types';
import { useParams, useRouter } from 'next/navigation';

export function useWorkbookParams() {
  const params = useParams();
  // the path could have 0, 1, or 2 parts
  // 3 parts: /workbooks/{workbookId}/{tableId}/{recordId}/{columnId}

  const workbookId = params.slug?.[0] as WorkbookId;
  const tableId = params.slug?.[1] as SnapshotTableId | undefined;
  const recordId = params.slug?.[2] as string | undefined;
  const columnId = params.slug?.[3] as string | undefined;
  const router = useRouter();

  // this is used to update the current path without triggering a rerender of the page
  const updateSnapshotPath = (workbookId: string, tableId?: string, recordId?: string, columnId?: string) => {
    if (tableId && recordId && columnId) {
      window.history.replaceState(null, '', RouteUrls.workbookColumnView(workbookId, tableId, recordId, columnId));
    } else if (tableId && recordId) {
      window.history.replaceState(null, '', RouteUrls.workbookRecordView(workbookId, tableId, recordId));
    } else if (tableId) {
      window.history.replaceState(null, '', RouteUrls.workbookTablePage(workbookId, tableId));
    } else {
      window.history.replaceState(null, '', RouteUrls.workbookPageUrl(workbookId));
    }
  };

  // this is used to push a new path to the history stack and triggers a rerender of the page
  const pushSnapshotPath = (workbookId: string, tableId?: string, recordId?: string, columnId?: string) => {
    if (tableId && recordId && columnId) {
      router.push(RouteUrls.workbookColumnView(workbookId, tableId, recordId, columnId));
    } else if (tableId && recordId) {
      router.push(RouteUrls.workbookRecordView(workbookId, tableId, recordId));
    } else if (tableId) {
      router.push(RouteUrls.workbookTablePage(workbookId, tableId));
    } else {
      router.push(RouteUrls.workbookPageUrl(workbookId));
    }
  };

  return { workbookId, tableId, recordId, columnId, updateSnapshotPath, pushSnapshotPath };
}
