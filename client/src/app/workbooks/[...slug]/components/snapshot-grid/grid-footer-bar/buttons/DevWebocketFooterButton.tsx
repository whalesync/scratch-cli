import { useDisclosure } from '@mantine/hooks';
import { BugIcon } from 'lucide-react';
import { useDevTools } from '../../../../../../../hooks/use-dev-tools';
import { ToolIconButton } from '../../../../../../components/ToolIconButton';
import { WorkbookWebsocketEventDebugDialog } from '../../../devtool/WorkbookWebsocketEventDebugDialog';

export const DevWebocketFooterButton = () => {
  const { isDevToolsEnabled } = useDevTools();
  const [isOpen, { close, toggle }] = useDisclosure(false);

  if (!isDevToolsEnabled) {
    return null;
  }
  return (
    <>
      <ToolIconButton
        icon={BugIcon}
        onClick={toggle}
        size="md"
        color="var(--mantine-color-devTool-9)"
        tooltip="Workbook dev event log"
      />
      <WorkbookWebsocketEventDebugDialog opened={isOpen} onClose={close} />
    </>
  );
};
