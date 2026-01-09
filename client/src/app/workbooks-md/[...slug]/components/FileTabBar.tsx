import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useFileList } from '@/hooks/use-file-list';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { Box, Group, Text } from '@mantine/core';
import { FileTextIcon, FolderIcon, PlusIcon, XIcon } from 'lucide-react';
import styles from './FileTabBar.module.css';

interface FileTabBarProps {
  onTabChange?: (tabId: string) => void;
}

export function FileTabBar({ onTabChange }: FileTabBarProps) {
  const { workbook } = useActiveWorkbook();
  const openFileTabs = useWorkbookEditorUIStore((state) => state.openFileTabs);
  const activeFileTabId = useWorkbookEditorUIStore((state) => state.activeFileTabId);
  const closeFileTab = useWorkbookEditorUIStore((state) => state.closeFileTab);
  const setActiveFileTab = useWorkbookEditorUIStore((state) => state.setActiveFileTab);
  const activeCells = useWorkbookEditorUIStore((state) => state.activeCells);
  const setActiveCells = useWorkbookEditorUIStore((state) => state.setActiveCells);
  const { files } = useFileList(workbook?.id ?? null);

  // We rely on openFileTabs, not files validation, to show tabs.
  // files might be undefined during refresh or initial load, but tabs should persist.
  if (openFileTabs.length === 0) {
    return null;
  }

  const handleTabClick = (tabId: string) => {
    setActiveFileTab(tabId);
    setActiveCells({
      recordId: tabId,
      columnId: activeCells?.columnId,
      viewType: 'md',
    });
    onTabChange?.(tabId);
  };

  const handleTabClose = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Close tab and handle active tab switching
    closeFileTab(tabId);
    // Update activeCells based on new active tab
    const newActiveId = useWorkbookEditorUIStore.getState().activeFileTabId;
    setActiveCells({
      recordId: newActiveId ?? undefined,
      columnId: activeCells?.columnId,
      viewType: 'md',
    });
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
      {openFileTabs.map((tab) => {
        const isFolder = tab.type === 'folder';
        const isActiveTab = activeFileTabId === tab.id;

        // get the actual file or folder for the tab
        const tabFile = files?.items.find((f) => f.id === tab.id);

        // We want to use the up to date file name when possible, but fallback to the tab title or id if not available
        const tabLabel = tabFile?.name || tab.title || tab.id;

        return (
          <Group
            key={tab.id}
            gap={4}
            px="sm"
            h={36}
            wrap="nowrap"
            onClick={() => handleTabClick(tab.id)}
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
              <FolderIcon size={12} color="var(--fg-secondary)" />
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
        );
      })}
    </Group>
  );
}
