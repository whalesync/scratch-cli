import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { API_CONFIG } from '@/lib/api/config';
import { SWR_KEYS } from '@/lib/api/keys';
import { Workbook } from '@/types/server-entities/workbook';
import { useSWRConfig } from 'swr';
import { SnapshotTableId } from '../types/server-entities/ids';

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

      // Use public endpoint that doesn't require authentication
      // Security relies on snapshot IDs being unguessable
      const url = `${API_CONFIG.getApiUrl()}/workbook/public/${workbook.id}/export-as-csv?tableId=${tableId}&filteredOnly=${filteredOnly}`;
      const filename = `${workbook.name || 'snapshot'}_${tableName}.csv`;

      // Create a hidden anchor element and click it to trigger download
      // This allows the browser to handle streaming natively
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

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
