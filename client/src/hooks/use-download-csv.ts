import { API_CONFIG } from '@/lib/api/config';
import { SWR_KEYS } from '@/lib/api/keys';
import { Snapshot } from '@/types/server-entities/snapshot';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useSWRConfig } from 'swr';

export const useExportAsCsv = () => {
  const { mutate: globalMutate } = useSWRConfig();
  
  const handleDownloadCsv = async (
    snapshot: Snapshot,
    tableId: string,
    tableName: string,
    setDownloading: (value: string | null) => void,
    filteredOnly: boolean = false,
  ) => {
    if (!snapshot) return;
    try {
      setDownloading(tableId);
      const response = await fetch(
        `${API_CONFIG.getApiUrl()}/snapshot/${snapshot.id}/download-csv?tableId=${tableId}&filteredOnly=${filteredOnly}`,
        {
          method: 'GET',
          headers: {
            ...API_CONFIG.getAuthHeaders(),
          },
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = `${snapshot.name || 'snapshot'}_${tableName}.csv`;
      a.download = filename;
      a.style.display = 'none';
      a.setAttribute('download', filename);
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      ScratchpadNotifications.success({
        message: 'CSV downloaded successfully.',
      });

      // Refresh the records cache for "Export All" to show the clean state (same as websocket pattern)
      if (!filteredOnly) {
        globalMutate(SWR_KEYS.snapshot.recordsKeyMatcher(snapshot.id, tableId), undefined, {
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
      setDownloading(null);
    }
  };

  return { handleDownloadCsv };
};
