import { ConnectorIcon } from '@/app/components/Icons/ConnectorIcon';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { Box, Group, Menu, Text } from '@mantine/core';
import { DataFolder, Service } from '@spinner/shared-types';
import { FileTextIcon, FolderIcon, PlusIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { useDataFolders } from '../../../../hooks/use-data-folders';
import styles from './TabBar.module.css';

interface TabBarProps {
  onTabChange?: (tabId: string) => void;
}

export function TabBar({ onTabChange }: TabBarProps) {
  const openFileTabs = useWorkbookEditorUIStore((state) => state.openFileTabs);
  const activeFileTabId = useWorkbookEditorUIStore((state) => state.activeFileTabId);
  const closeFileTab = useWorkbookEditorUIStore((state) => state.closeFileTab);
  const closeFileTabs = useWorkbookEditorUIStore((state) => state.closeFileTabs);
  const setActiveFileTab = useWorkbookEditorUIStore((state) => state.setActiveFileTab);
  const { folders } = useDataFolders();

  // Context menu state
  const [contextMenuTabId, setContextMenuTabId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  // We rely on openFileTabs, not files validation, to show tabs.
  // files might be undefined during refresh or initial load, but tabs should persist.
  if (openFileTabs.length === 0) {
    return null;
  }

  const handleTabClick = (tabId: string) => {
    setActiveFileTab(tabId);
    onTabChange?.(tabId);
  };

  const handleTabClose = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Close tab and handle active tab switching
    closeFileTab(tabId);
  };

  // Context menu handlers
  const handleCloseAllTabs = () => {
    const allTabIds = openFileTabs.map((tab) => tab.id);
    closeFileTabs(allTabIds);
  };

  const handleCloseOtherTabs = (tabId: string) => {
    const otherTabIds = openFileTabs.filter((tab) => tab.id !== tabId).map((tab) => tab.id);
    closeFileTabs(otherTabIds);
  };

  const handleCloseTabsToRight = (tabId: string) => {
    const tabIndex = openFileTabs.findIndex((tab) => tab.id === tabId);
    if (tabIndex === -1 || tabIndex === openFileTabs.length - 1) return;

    const tabsToClose = openFileTabs.slice(tabIndex + 1).map((tab) => tab.id);
    closeFileTabs(tabsToClose);
  };

  const handleCloseTabsToLeft = (tabId: string) => {
    const tabIndex = openFileTabs.findIndex((tab) => tab.id === tabId);
    if (tabIndex === -1 || tabIndex === 0) return;

    const tabsToClose = openFileTabs.slice(0, tabIndex).map((tab) => tab.id);
    closeFileTabs(tabsToClose);
  };

  return (
    <Group
      gap={0}
      h={36}
      wrap="nowrap"
      className={styles.tabBarContainer}
      style={{
        borderBottom: '0.5px solid var(--fg-divider)',
      }}
    >
      {openFileTabs.map((tab, index) => {
        const isFolder = tab.type === 'folder';
        const isActiveTab = activeFileTabId === tab.id;

        // get the actual file or folder object represented by the tab
        let tabObject;
        if (isFolder) {
          tabObject = folders?.find((df) => df.id === tab.id);
        }

        // We want to use the up to date file name when possible, but fallback to the tab title or id if not available
        const tabLabel = tabObject?.name || tab.title || tab.id;

        const handleContextMenu = (e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          setMenuPosition({ x: e.clientX, y: e.clientY });
          setContextMenuTabId(tab.id);
        };

        return (
          <Box key={tab.id}>
            <Group
              key={tab.id}
              gap={4}
              px="sm"
              h={36}
              wrap="nowrap"
              onClick={() => handleTabClick(tab.id)}
              onContextMenu={handleContextMenu}
              style={{
                cursor: 'pointer',
                borderRight: '1px solid var(--fg-divider)',
                backgroundColor: isActiveTab ? 'var(--bg-base)' : 'var(--bg-surface)',
                borderBottom: isActiveTab ? '2px solid var(--mantine-color-blue-6)' : 'none',
                flexShrink: 0,
                minWidth: 'fit-content',
              }}
            >
              {isFolder ? (
                (tabObject as DataFolder)?.connectorService ? (
                  <ConnectorIcon connector={(tabObject as DataFolder).connectorService as Service} size={12} p={0} />
                ) : (
                  <FolderIcon size={12} color="var(--fg-secondary)" />
                )
              ) : tab.type === 'add-table' ? (
                <PlusIcon size={12} color="var(--fg-secondary)" />
              ) : (
                <FileTextIcon size={12} color="var(--fg-secondary)" />
              )}
              <Text size="xs" truncate style={{ maxWidth: '120px' }}>
                {tabLabel}
              </Text>
              <Box
                onClick={(e) => handleTabClose(tab.id, e)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px',
                  borderRadius: '2px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--mantine-color-gray-3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <XIcon size={12} color="var(--fg-secondary)" />
              </Box>
            </Group>
            {contextMenuTabId === tab.id && (
              <Menu
                opened={contextMenuTabId === tab.id}
                onChange={(opened) => !opened && setContextMenuTabId(null)}
                position="bottom-start"
                withinPortal
              >
                <Menu.Target>
                  <Box style={{ position: 'fixed', top: menuPosition.y, left: menuPosition.x, width: 0, height: 0 }} />
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item onClick={handleCloseAllTabs}>Close all</Menu.Item>
                  <Menu.Item onClick={() => handleCloseOtherTabs(tab.id)} disabled={openFileTabs.length === 1}>
                    Close others
                  </Menu.Item>
                  <Menu.Item onClick={() => handleCloseTabsToLeft(tab.id)} disabled={index === 0}>
                    Close all to the left
                  </Menu.Item>
                  <Menu.Item
                    onClick={() => handleCloseTabsToRight(tab.id)}
                    disabled={index === openFileTabs.length - 1}
                  >
                    Close all to the right
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
          </Box>
        );
      })}
    </Group>
  );
}
