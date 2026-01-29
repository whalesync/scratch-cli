import { useDevTools } from '@/hooks/use-dev-tools';
import { useWorkbookEditorUIStore, WorkbookModals } from '@/stores/workbook-editor-store';
import { RouteUrls } from '@/utils/route-urls';
import { Loader, Menu } from '@mantine/core';
import { Service, SnapshotTable } from '@spinner/shared-types';
import { Edit3Icon, Trash2Icon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useActiveWorkbook } from '../../../../hooks/use-active-workbook';
import { ActionIconThreeDots } from '../../../components/base/action-icons';
import { DevToolMenuItem } from '../../../components/DevToolMenu';
import { WebflowPublishSiteMenuItem } from './WebflowPublishSiteMenuItem';

export const WorkbookActionsMenu = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { workbook, activeTable, isLoading } = useActiveWorkbook();
  const { isDevToolsEnabled } = useDevTools();
  const showModal = useWorkbookEditorUIStore((state) => state.showModal);
  const [saving, setSaving] = useState(false);
  const openDevTools = useWorkbookEditorUIStore((state) => state.openDevTools);

  const handleOpenAdvancedInput = () => {
    if (!workbook) return;
    router.push(`/agent-input/${workbook.id}`);
  };

  const menuItemsDisabled = isLoading || saving;

  const renderConnectorCustomActions = () => {
    if (!workbook || !activeTable) return null;

    // Webflow-specific actions
    if (activeTable.connectorService === Service.WEBFLOW) {
      return (
        <>
          <Menu.Divider />
          <Menu.Label>Webflow</Menu.Label>
          <WebflowPublishSiteMenuItem
            currentTable={activeTable as SnapshotTable}
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

        {/* Connector-custom actions */}
        {renderConnectorCustomActions()}

        {isDevToolsEnabled && (
          <>
            <Menu.Divider />
            <Menu.Label>Dev Tools</Menu.Label>
            <DevToolMenuItem onClick={openDevTools}> Workbook Inspector</DevToolMenuItem>
            <DevToolMenuItem onClick={handleOpenAdvancedInput}>Advanced Agent Input</DevToolMenuItem>
            {!RouteUrls.isWorkbookFilePage(pathname) && (
              <DevToolMenuItem onClick={() => router.push(RouteUrls.workbookFilePageUrl(workbook?.id ?? ''))}>
                Switch to File View
              </DevToolMenuItem>
            )}
            {RouteUrls.isWorkbookFilePage(pathname) && (
              <DevToolMenuItem onClick={() => router.push(RouteUrls.workbookScratchSyncPageUrl(workbook?.id ?? ''))}>
                Switch to ScratchSync View
              </DevToolMenuItem>
            )}
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
