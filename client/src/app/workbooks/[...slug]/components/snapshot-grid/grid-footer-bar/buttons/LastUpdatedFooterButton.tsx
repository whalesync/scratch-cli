import { ButtonSecondaryInline } from '@/app/components/base/buttons';
import { SnapshotTable } from '@/types/server-entities/workbook';
import { CloudDownloadIcon, RefreshCwIcon } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const LastUpdatedFooterButton = ({ table }: { table: SnapshotTable }) => {
  return (
    <ButtonSecondaryInline leftSection={<CloudDownloadIcon size={16} />} rightSection={<RefreshCwIcon size={16} />}>
      1h ago
    </ButtonSecondaryInline>
  );
};
