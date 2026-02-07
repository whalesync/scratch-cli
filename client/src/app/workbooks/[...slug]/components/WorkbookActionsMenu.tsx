import { useDevTools } from '@/hooks/use-dev-tools';
import { useWorkbookEditorUIStore, WorkbookModals } from '@/stores/workbook-editor-store';
import { Menu } from '@mantine/core';
import { Edit3Icon, Trash2Icon } from 'lucide-react';
import { useActiveWorkbook } from '../../../../hooks/use-active-workbook';
import { ActionIconThreeDots } from '../../../components/base/action-icons';
import { DevToolMenuItem } from '../../../components/DevToolMenu';

export const WorkbookActionsMenu = () => {
  const { workbook, isLoading } = useActiveWorkbook();
  const { isDevToolsEnabled } = useDevTools();
  const showModal = useWorkbookEditorUIStore((state) => state.showModal);
  const openDevTools = useWorkbookEditorUIStore((state) => state.openDevTools);

  const menuItemsDisabled = isLoading;

  return (
    <Menu>
      <Menu.Target>
        <ActionIconThreeDots />
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          disabled={menuItemsDisabled}
          onClick={() => showModal({ type: WorkbookModals.RENAME_WORKBOOK })}
          leftSection={<Edit3Icon size={16} />}
        >
          Rename workbook
        </Menu.Item>

        {/* Connector-custom actions */}

        {isDevToolsEnabled && (
          <>
            <Menu.Divider />
            <Menu.Label>Dev Tools</Menu.Label>
            <DevToolMenuItem onClick={openDevTools}> Workbook Inspector</DevToolMenuItem>
          </>
        )}

        <Menu.Divider />
        {workbook && (
          <Menu.Item
            data-delete
            disabled={menuItemsDisabled}
            leftSection={<Trash2Icon size={16} />}
            onClick={() => showModal({ type: WorkbookModals.CONFIRM_DELETE, workbookId: workbook.id })}
          >
            Delete workbook
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
};
