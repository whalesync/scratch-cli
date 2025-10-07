import { API_CONFIG } from '@/lib/api/config';
import { Snapshot } from '@/types/server-entities/snapshot';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';

export const useDownloadCsv = () => {
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
      a.download = `${snapshot.name || 'snapshot'}_${tableName}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      ScratchpadNotifications.success({
        message: 'CSV downloaded successfully.',
      });
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
