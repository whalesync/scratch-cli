import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { SWR_KEYS } from '@/lib/api/keys';
import { workbookApi } from '@/lib/api/workbook';
import { SnapshotTableId, Workbook } from '@spinner/shared-types';
import { useSWRConfig } from 'swr';

export const useExportAsCsv = () => {
  const { mutate: globalMutate } = useSWRConfig();

  const handleDownloadCsv = async (
    workbook: Workbook,
    tableId: SnapshotTableId,
    tableName: string,
    setDownloading: (value: string | null) => void,
    filteredOnly: boolean = false,
  ) => {
    if (!workbook) return;
    try {
      setDownloading(tableId);

      await workbookApi.exportAsCSV(workbook, tableId, tableName, filteredOnly);

      ScratchpadNotifications.success({
        message: 'CSV downloaded successfully.',
      });

      // Refresh the records cache for "Export All" to show the clean state (same as websocket pattern)
      if (!filteredOnly) {
        globalMutate(SWR_KEYS.workbook.recordsKeyMatcher(workbook.id, tableId), undefined, {
          revalidate: true,
        });
      }
    } catch (e) {
      console.error(e);
      ScratchpadNotifications.error({
        title: 'Download failed',
        message: 'There was an error downloading the CSV file.',
      });
    } finally {
      // Small delay to show the loading state before clearing
      setTimeout(() => setDownloading(null), 500);
    }
  };

  return { handleDownloadCsv };
};
