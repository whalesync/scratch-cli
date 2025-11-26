import { useDevTools } from '@/hooks/use-dev-tools';
import { useWorkbookEditorUIStore, WorkbookModals } from '@/stores/workbook-editor-store';
import { Loader, Menu } from '@mantine/core';
import { Edit3Icon, EyeOffIcon, Trash2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import pluralize from 'pluralize';
import { useState } from 'react';
import { useActiveWorkbook } from '../../../../hooks/use-active-workbook';
import { Service } from '../../../../types/server-entities/connector-accounts';
import { ActionIconThreeDots } from '../../../components/base/action-icons';
import { DevToolMenuItem } from '../../../components/DevToolMenu';
import { WebflowPublishSiteMenuItem } from './snapshot-grid/custom-actions/webflow/WebflowPublishSiteMenuItem';

export const WorkbookActionsMenu = () => {
  const router = useRouter();
  const { workbook, activeTable, isLoading, unhideTable } = useActiveWorkbook();
  const { isDevToolsEnabled } = useDevTools();
  const showModal = useWorkbookEditorUIStore((state) => state.showModal);
  const [saving, setSaving] = useState(false);
  const openDevTools = useWorkbookEditorUIStore((state) => state.openDevTools);

  const handleOpenAdvancedInput = () => {
    if (!workbook) return;
    router.push(`/agent-input/${workbook.id}`);
  };

  const menuItemsDisabled = isLoading || saving;

  const hiddenTables = workbook?.snapshotTables?.filter((table) => table.hidden) ?? [];

  const renderConnectorCustomActions = () => {
    if (!workbook || !activeTable) return null;

    // Webflow-specific actions
    if (activeTable.connectorService === Service.WEBFLOW) {
      return (
        <>
          <Menu.Divider />
          <Menu.Label>Webflow</Menu.Label>
          <WebflowPublishSiteMenuItem
            currentTable={activeTable}
            disabled={menuItemsDisabled}
            onPublishStart={() => setSaving(true)}
            onPublishEnd={() => setSaving(false)}
          />
        </>
      );
    }

    return null;
  };

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

        {hiddenTables.length > 0 && (
          <>
            <Menu.Divider />
            <Menu.Label>{`${hiddenTables.length} hidden ${pluralize('table', hiddenTables.length)}`}</Menu.Label>
            {hiddenTables.map((table) => (
              <Menu.Item key={table.id} leftSection={<EyeOffIcon size={16} />} onClick={() => unhideTable(table.id)}>
                Show {table.tableSpec.name}
              </Menu.Item>
            ))}
          </>
        )}

        {/* Connector-custom actions */}
        {renderConnectorCustomActions()}

        {isDevToolsEnabled && (
          <>
            <Menu.Divider />
            <Menu.Label>Dev Tools</Menu.Label>
            <DevToolMenuItem onClick={openDevTools}> Workbook Inspector</DevToolMenuItem>
            <DevToolMenuItem onClick={handleOpenAdvancedInput}>Advanced Agent Input</DevToolMenuItem>
          </>
        )}

        <Menu.Divider />
        {workbook && (
          <Menu.Item
            data-delete
            disabled={menuItemsDisabled}
            leftSection={saving ? <Loader size="xs" /> : <Trash2Icon size={16} />}
            onClick={() => showModal({ type: WorkbookModals.CONFIRM_DELETE, workbookId: workbook.id })}
          >
            Delete workbook
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
};
