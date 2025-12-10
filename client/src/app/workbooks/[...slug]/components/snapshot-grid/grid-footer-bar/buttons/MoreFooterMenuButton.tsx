import { ButtonSecondaryInline } from '@/app/components/base/buttons';
import { recordApi } from '@/lib/api/record';
import { SnapshotTable } from '@/types/server-entities/workbook';
import { Loader, Menu } from '@mantine/core';
import { EllipsisVerticalIcon, FileDownIcon, FileUpIcon } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { mutate } from 'swr';
import { useActiveWorkbook } from '../../../../../../../hooks/use-active-workbook';
import { useExportAsCsv } from '../../../../../../../hooks/use-export-as-csv';
import { SWR_KEYS } from '../../../../../../../lib/api/keys';
import { ScratchpadNotifications } from '../../../../../../components/ScratchpadNotifications';

export const MoreFooterMenuButton = ({ table }: { table: SnapshotTable }) => {
  const { workbook } = useActiveWorkbook();

  // Download files
  const { handleDownloadCsv } = useExportAsCsv();
  const [downloadingCsv, setDownloadingCsv] = useState<string | null>(null);

  // Import suggestions
  const [uploadingSuggestions, setUploadingSuggestions] = useState<boolean>(false);
  const suggestionsFileInputRef = useRef<Record<string, HTMLInputElement | null>>({});

  const downloadCsv = useCallback(
    (filteredOnly: boolean) => {
      if (!workbook) {
        return;
      }
      handleDownloadCsv(workbook, table.id, table.tableSpec.name, setDownloadingCsv, filteredOnly);
    },
    [workbook, handleDownloadCsv, table.id, table.tableSpec.name],
  );

  const handleImportSuggestions = async (file: File | null) => {
    if (!workbook || !file) {
      console.debug('handleImportSuggestions: early return', { workbook: !!workbook, file: !!file });
      return;
    }

    console.debug('handleImportSuggestions: starting', {
      workbookId: workbook.id,
      table: table.id,
      fileName: file.name,
    });

    try {
      setUploadingSuggestions(true);
      const result = await recordApi.importSuggestions(workbook.id, table.id, file);
      await mutate(SWR_KEYS.operationCounts.get(workbook.id));
      console.debug('handleImportSuggestions: success', result);
      ScratchpadNotifications.success({
        title: 'Import completed',
        message: `Processed ${result.recordsProcessed} records and created ${result.suggestionsCreated} suggestions.`,
      });
    } catch (error) {
      console.error('handleImportSuggestions: error', error);
      ScratchpadNotifications.error({
        title: 'Import failed',
        message: error instanceof Error ? error.message : 'There was an error importing the suggestions.',
      });
    } finally {
      setUploadingSuggestions(false);
    }
  };

  return (
    <Menu width="auto">
      <Menu.Target>
        <ButtonSecondaryInline>
          <EllipsisVerticalIcon size={13} />
        </ButtonSecondaryInline>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          disabled={!!downloadingCsv}
          onClick={() => downloadCsv(false)}
          leftSection={downloadingCsv ? <Loader size="xs" /> : <FileDownIcon size={13} />}
        >
          Download all records as CSV
        </Menu.Item>
        <Menu.Item
          disabled={!!downloadingCsv}
          onClick={() => {
            downloadCsv(true);
          }}
          leftSection={downloadingCsv ? <Loader size="xs" /> : <FileDownIcon size={13} />}
        >
          Download current records as CSV
        </Menu.Item>
        {/* TODO: Should we show suggestions here too?
          <Menu.Item>Accept all suggestions</Menu.Item>
          <Menu.Item>Reject all suggestions</Menu.Item>
        */}

        <Menu.Item
          disabled={uploadingSuggestions}
          onClick={(e) => {
            e.preventDefault();
            console.debug('Menu.Item clicked for table:', table.id);
            const input = suggestionsFileInputRef.current[table.id];
            if (input) {
              console.debug('Triggering file input click');
              input.click();
            } else {
              console.debug('File input ref not found for table:', table.id);
            }
          }}
          leftSection={uploadingSuggestions ? <Loader size="xs" /> : <FileUpIcon size={13} />}
          closeMenuOnClick={false}
        >
          Import Suggestions from CSV
        </Menu.Item>
        <input
          key={`file-input-${table.id}`}
          type="file"
          ref={(el) => {
            suggestionsFileInputRef.current[table.id] = el;
          }}
          accept=".csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            console.debug('File input onChange triggered', { files: e.target.files?.length });
            const file = e.target.files?.[0];
            if (file) {
              console.debug('File selected:', file.name);
              handleImportSuggestions(file);
              e.target.value = ''; // Reset input
            }
          }}
        />
      </Menu.Dropdown>
    </Menu>
  );
};
