'use client';

import { useRouter } from 'next/navigation';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useFileList } from '@/hooks/use-file-list';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { RouteUrls } from '@/utils/route-urls';
import { Box, Button, Group, ScrollArea, Stack, Text } from '@mantine/core';
import type { FileRefEntity, FolderRefEntity } from '@spinner/shared-types';
import {
  BookOpenIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  PlusIcon,
} from 'lucide-react';
import { useState } from 'react';

interface WorkbookFileBrowserProps {
  openTabs: string[];
  setOpenTabs: React.Dispatch<React.SetStateAction<string[]>>;
  activeTabId: string | null;
  setActiveTabId: React.Dispatch<React.SetStateAction<string | null>>;
  refreshWorkbook?: () => Promise<void>;
}

// Helper function to recursively render folders and files
function renderFileTree(
  entity: FileRefEntity | FolderRefEntity,
  level: number,
  expandedFolders: Set<string>,
  setExpandedFolders: React.Dispatch<React.SetStateAction<Set<string>>>,
  activeTabId: string | null,
  onFileClick: (filePath: string) => void,
): React.ReactNode {
  const indent = level * 18;

  if (entity.type === 'folder') {
    const isExpanded = expandedFolders.has(entity.path);

    return (
      <Box key={entity.path}>
        <Group
          gap="xs"
          h={24}
          pl={indent + 6}
          pr="xs"
          onClick={() => {
            setExpandedFolders((prev) => {
              const next = new Set(prev);
              if (next.has(entity.path)) {
                next.delete(entity.path);
              } else {
                next.add(entity.path);
              }
              return next;
            });
          }}
          style={{
            cursor: 'pointer',
            borderRadius: '4px',
          }}
          bg="transparent"
        >
          {isExpanded ? (
            <ChevronDownIcon size={14} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />
          ) : (
            <ChevronRightIcon size={14} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />
          )}
          <FolderIcon size={14} color="var(--fg-secondary)" />
          <Text size="sm" c="var(--fg-secondary)" truncate>
            {entity.name}
          </Text>
        </Group>

        {isExpanded && (
          <Stack gap={0}>
            {entity.children.map((child) =>
              renderFileTree(child, level + 1, expandedFolders, setExpandedFolders, activeTabId, onFileClick),
            )}
          </Stack>
        )}
      </Box>
    );
  } else {
    // File node
    const isSelected = activeTabId === entity.path;

    return (
      <Group
        key={entity.path}
        h={24}
        pl={indent + 6}
        pr="xs"
        gap="xs"
        onClick={() => onFileClick(entity.path)}
        bg={isSelected ? 'var(--bg-selected)' : 'transparent'}
        style={{
          cursor: 'pointer',
          borderRadius: '4px',
        }}
      >
        <Box w={14} style={{ flexShrink: 0 }} />
        <FileTextIcon size={12} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />
        <Text size="sm" truncate c={isSelected ? 'var(--fg-primary)' : 'var(--fg-secondary)'}>
          {entity.name}
        </Text>
      </Group>
    );
  }
}

export function WorkbookFileBrowser({
  setOpenTabs,
  activeTabId,
  setActiveTabId,
}: WorkbookFileBrowserProps) {
  const router = useRouter();
  const { workbook } = useActiveWorkbook();
  const activeCells = useWorkbookEditorUIStore((state) => state.activeCells);
  const setActiveCells = useWorkbookEditorUIStore((state) => state.setActiveCells);

  // Use the file list hook
  const { files, isLoading } = useFileList(workbook?.id ?? null);

  // State for workbook tree expansion
  const [workbookExpanded, setWorkbookExpanded] = useState(true);

  // State for folder expansion (track which folders are expanded)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const handleFileClick = (filePath: string) => {
    // Add to open tabs if not already open
    setOpenTabs((prev) => {
      if (!prev.includes(filePath)) {
        return [...prev, filePath];
      }
      return prev;
    });

    // Set as active tab
    setActiveTabId(filePath);

    // Update activeCells for compatibility
    setActiveCells({
      recordId: filePath,
      columnId: activeCells?.columnId,
      viewType: 'md',
    });
  };

  if (!workbook) {
    return null;
  }

  return (
    <Stack h="100%" gap={0} bg="var(--bg-base)" style={{ border: '0.5px solid var(--fg-divider)' }}>
      {/* Tree Header */}
      <Group h={36} px="xs" justify="space-between" style={{ borderBottom: '0.5px solid var(--fg-divider)' }}>
        <Text fw={500} size="sm">
          Explorer
        </Text>
        <Group gap={4}>
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            leftSection={<PlusIcon size={12} />}
            onClick={() => router.push(RouteUrls.workbooksPageUrl)}
          >
            WB
          </Button>
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            leftSection={<PlusIcon size={12} />}
            onClick={() => router.push(RouteUrls.workbookNewTabPageUrl(workbook.id))}
          >
            Table
          </Button>
        </Group>
      </Group>

      <ScrollArea style={{ flex: 1 }}>
        <Stack gap={0} p="xs">
          {/* Workbook Node (Top Level) */}
          <Box>
            <Group
              gap="xs"
              h={24}
              px="sm"
              onClick={() => setWorkbookExpanded(!workbookExpanded)}
              style={{
                cursor: 'pointer',
                borderRadius: '4px',
              }}
              bg="transparent"
            >
              {workbookExpanded ? (
                <ChevronDownIcon size={14} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />
              ) : (
                <ChevronRightIcon size={14} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />
              )}
              <BookOpenIcon size={14} color="var(--fg-secondary)" />
              <Text size="sm" fw={500} c="var(--fg-primary)" truncate>
                {workbook.name || 'Untitled Workbook'}
              </Text>
            </Group>

            {/* Files and Folders */}
            {workbookExpanded && (
              <Stack gap={0} ml={6} style={{ borderLeft: '1px solid var(--fg-divider)' }}>
                {isLoading && (
                  <Box pl={18} py="xs">
                    <Text size="xs" c="dimmed">
                      Loading files...
                    </Text>
                  </Box>
                )}
                {!isLoading && !files?.root && (
                  <Box pl={18} py="xs">
                    <Text size="xs" c="dimmed">
                      No files
                    </Text>
                  </Box>
                )}
                {!isLoading &&
                  files?.root &&
                  files.root.children.map((child) =>
                    renderFileTree(child, 1, expandedFolders, setExpandedFolders, activeTabId, handleFileClick),
                  )}
              </Stack>
            )}
          </Box>
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
