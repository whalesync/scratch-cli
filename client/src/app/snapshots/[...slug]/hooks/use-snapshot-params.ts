import { RouteUrls } from '@/utils/route-urls';
import { useParams, useRouter } from 'next/navigation';

export function useSnapshotParams() {
  const params = useParams();
  // the path could have 0, 1, or 2 parts
  // 3 parts: /snapshots/{snapshotId}/{tableId}/{recordId}/{columnId}

  const snapshotId = params.slug?.[0] as string;
  const tableId = params.slug?.[1] as string | undefined;
  const recordId = params.slug?.[2] as string | undefined;
  const columnId = params.slug?.[3] as string | undefined;
  const router = useRouter();

  // this is used to update the current path without triggering a rerender of the page
  const updateSnapshotPath = (snapshotId: string, tableId?: string, recordId?: string, columnId?: string) => {
    if (tableId && recordId && columnId) {
      window.history.replaceState(null, '', RouteUrls.snapshotColumnView(snapshotId, tableId, recordId, columnId));
    } else if (tableId && recordId) {
      window.history.replaceState(null, '', RouteUrls.snapshotRecordView(snapshotId, tableId, recordId));
    } else if (tableId) {
      window.history.replaceState(null, '', RouteUrls.snapshotTablePage(snapshotId, tableId));
    } else {
      window.history.replaceState(null, '', RouteUrls.snapshotPage(snapshotId));
    }
  };

  // this is used to push a new path to the history stack and triggers a rerender of the page
  const pushSnapshotPath = (snapshotId: string, tableId?: string, recordId?: string, columnId?: string) => {
    if (tableId && recordId && columnId) {
      router.push(RouteUrls.snapshotColumnView(snapshotId, tableId, recordId, columnId));
    } else if (tableId && recordId) {
      router.push(RouteUrls.snapshotRecordView(snapshotId, tableId, recordId));
    } else if (tableId) {
      router.push(RouteUrls.snapshotTablePage(snapshotId, tableId));
    } else {
      router.push(RouteUrls.snapshotPage(snapshotId));
    }
  };

  return { snapshotId, tableId, recordId, columnId, updateSnapshotPath, pushSnapshotPath };
}
