import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { workbookApi } from '@/lib/api/workbook';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import {
  Accordion,
  ActionIcon,
  Badge,
  Box,
  Button,
  Collapse,
  Group,
  ScrollArea,
  Stack,
  Text,
} from '@mantine/core';
import {
  CloudUpload,
  FileDiffIcon,
  FileIcon,
  FileMinusIcon,
  FilePlusIcon,
  FolderIcon,
  FolderOpenIcon,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './DataFolderBrowser.module.css';

export interface DirtyFile {
  path: string;
  status: 'added' | 'modified' | 'deleted';
}

type FileStatus = 'added' | 'modified' | 'deleted';

interface Stats {
  added: number;
  modified: number;
  deleted: number;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: Record<string, TreeNode>;
  status?: FileStatus;
  stats?: Stats; // Aggregated stats for directories
}

interface UnpublishedChangesPanelProps {
  onPublishAll?: () => Promise<void> | void;
  onDiscardAll?: () => Promise<void> | void;
  onPublishItem?: (path: string) => Promise<void> | void;
  onDiscardItem?: (path: string) => Promise<void> | void;
  onFileClick?: (path: string) => void;
}

export function UnpublishedChangesPanel({
  onPublishAll,
  onDiscardAll,
  onPublishItem,
  onDiscardItem,
  onFileClick,
}: UnpublishedChangesPanelProps) {
  const { workbook } = useActiveWorkbook();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [dirtyFiles, setDirtyFiles] = useState<DirtyFile[]>([]);
  const [loading, setLoading] = useState(false);
  const openFileTabs = useWorkbookEditorUIStore((state) => state.openFileTabs);
  const activeFileTabId = useWorkbookEditorUIStore((state) => state.activeFileTabId);

  const fetchGitStatus = useCallback(async () => {
    if (!workbook?.id) return;
    setLoading(true);
    try {
      const data = (await workbookApi.getStatus(workbook.id)) as DirtyFile[];
      setDirtyFiles(data || []);
    } catch (error) {
      console.error('Failed to fetch unpublished changes:', error);
    } finally {
      setLoading(false);
    }
  }, [workbook?.id]);

  const handlePublishAll = async () => {
    if (!onPublishAll) return;
    setLoading(true);
    try {
      await onPublishAll();
      await fetchGitStatus();
    } finally {
      setLoading(false);
    }
  };

  const handleDiscardAll = async () => {
    if (!onDiscardAll) return;
    if (!confirm('Are you sure you want to discard all unpublished changes? This cannot be undone.')) return;
    setLoading(true);
    try {
      await onDiscardAll();
      await fetchGitStatus();
    } finally {
      setLoading(false);
    }
  };

  const handleDiscardItem = async (path: string) => {
    if (!onDiscardItem) return;
    if (!confirm(`Are you sure you want to discard changes to ${path}? This cannot be undone.`)) return;
    setLoading(true);
    try {
      await onDiscardItem(path);
      await fetchGitStatus();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGitStatus();
  }, [fetchGitStatus]);

  // Expand parent folders when deep linking to a file in review mode
  useEffect(() => {
    if (!activeFileTabId) return;

    const activeTab = openFileTabs.find((t) => t.id === activeFileTabId);
    if (!activeTab?.path) return;

    // Expand all parent folders of the active file
    const pathParts = activeTab.path.split('/');
    const foldersToExpand = new Set<string>();
    for (let i = 1; i < pathParts.length; i++) {
      foldersToExpand.add(pathParts.slice(0, i).join('/'));
    }

    if (foldersToExpand.size > 0) {
      setExpandedFolders((prev) => new Set([...prev, ...foldersToExpand]));
    }
  }, [activeFileTabId, openFileTabs]);

  const changesStats = useMemo(() => {
    return dirtyFiles.reduce(
      (acc, file) => {
        acc[file.status]++;
        return acc;
      },
      { added: 0, modified: 0, deleted: 0 },
    );
  }, [dirtyFiles]);

  const tree = useMemo(() => {
    const root: Record<string, TreeNode> = {};

    dirtyFiles.forEach((file) => {
      const parts = file.path.split('/');
      let currentLevel = root;
      let currentPath = '';

      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (!currentLevel[part]) {
          currentLevel[part] = {
            name: part,
            path: currentPath,
            type: isLast ? 'file' : 'directory',
            children: isLast ? undefined : {},
            status: isLast ? file.status : undefined,
          };
        }

        if (!isLast) {
          currentLevel = currentLevel[part].children!;
        }
      });
    });

    // Helper to compute stats recursively
    const computeStats = (nodes: Record<string, TreeNode>): void => {
      Object.values(nodes).forEach((node) => {
        if (node.type === 'directory' && node.children) {
          computeStats(node.children);
          node.stats = Object.values(node.children).reduce(
            (acc, child) => {
              if (child.type === 'file' && child.status) {
                acc[child.status]++;
              } else if (child.type === 'directory' && child.stats) {
                acc.added += child.stats.added;
                acc.modified += child.stats.modified;
                acc.deleted += child.stats.deleted;
              }
              return acc;
            },
            { added: 0, modified: 0, deleted: 0 } as Stats,
          );
        }
      });
    };

    computeStats(root);
    return root;
  }, [dirtyFiles]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderTreeNodes = (nodes: Record<string, TreeNode>) => {
    return Object.values(nodes)
      .sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
      })
      .map((node) => (
        <TreeNodeItem
          key={node.path}
          node={node}
          expandedFolders={expandedFolders}
          onToggle={toggleFolder}
          renderChildren={renderTreeNodes}
          onPublish={onPublishItem}
          onDiscard={handleDiscardItem}
          onFileClick={onFileClick}
        />
      ));
  };

  const hasChanges = dirtyFiles.length > 0;

  return (
    <Accordion.Item value="changes">
      {/* Header - ActionIcon is outside Accordion.Control to avoid nested buttons */}
      <Box style={{ position: 'relative' }}>
        <Accordion.Control icon={<FileDiffIcon size={14} color="var(--mantine-color-gray-7)" />}>
          <Text size="sm" fw={500} truncate w="100%" pr={120}>
            Unpublished Changes
          </Text>
        </Accordion.Control>

        {/* Badges and refresh button positioned outside Accordion.Control to avoid button-in-button */}
        <Group
          gap={4}
          wrap="nowrap"
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: 'var(--bg-selected)',
            zIndex: 1,
          }}
          pl={8}
        >
          {changesStats.added > 0 && (
            <Badge size="sm" color="green" variant="filled" style={{ paddingLeft: 4, paddingRight: 4 }}>
              <Group gap={2} justify="center" wrap="nowrap">
                <FilePlusIcon size={10} />
                <span style={{ fontSize: 9 }}>{changesStats.added}</span>
              </Group>
            </Badge>
          )}
          {changesStats.modified > 0 && (
            <Badge size="sm" color="orange" variant="filled" style={{ paddingLeft: 4, paddingRight: 4 }}>
              <Group gap={2} justify="center" wrap="nowrap">
                <FileDiffIcon size={10} style={{ marginRight: -2 }} />
                <span style={{ fontSize: 9 }}>{changesStats.modified}</span>
              </Group>
            </Badge>
          )}
          {changesStats.deleted > 0 && (
            <Badge size="sm" color="red" variant="filled" style={{ paddingLeft: 4, paddingRight: 4 }}>
              <Group gap={2} justify="center" wrap="nowrap">
                <FileMinusIcon size={10} style={{ marginRight: -2 }} />
                <span style={{ fontSize: 9 }}>{changesStats.deleted}</span>
              </Group>
            </Badge>
          )}
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              fetchGitStatus();
            }}
            loading={loading}
          >
            <RefreshCw size={14} />
          </ActionIcon>
        </Group>
      </Box>
      <Accordion.Panel>
        {/* Fill available height */}
        <Stack h="100%" gap={0} bg="var(--bg-base)">
          {hasChanges ? (
            <>
              <Box p="xs" pb={0}>
                <Group grow gap="xs">
                  <Button
                    variant="light"
                    color="blue"
                    leftSection={<CloudUpload size={16} />}
                    onClick={handlePublishAll}
                    loading={loading}
                    size="xs"
                  >
                    Publish All
                  </Button>
                  <Button
                    variant="light"
                    color="red"
                    leftSection={<RotateCcw size={16} />}
                    onClick={handleDiscardAll}
                    loading={loading}
                    size="xs"
                  >
                    Discard All
                  </Button>
                </Group>
              </Box>
              {/* Allow scroll area to determine height */}
              <ScrollArea style={{ flex: 1, overflowX: 'hidden' }}>
                <Box p="xs" pt="xs">
                  {renderTreeNodes(tree)}
                </Box>
              </ScrollArea>
            </>
          ) : (
            <Box p="lg">
              <Text c="dimmed" size="xs" ta="center">
                No unpublished changes.
              </Text>
            </Box>
          )}
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

function TreeNodeItem({
  node,
  expandedFolders,
  onToggle,
  renderChildren,
  onPublish,
  onDiscard,
  onFileClick,
}: {
  node: TreeNode;
  expandedFolders: Set<string>;
  onToggle: (path: string) => void;
  renderChildren: (nodes: Record<string, TreeNode>) => React.ReactNode;
  onPublish?: (path: string) => void;
  onDiscard?: (path: string) => void;
  onFileClick?: (path: string) => void;
}) {
  const isExpanded = expandedFolders.has(node.path);
  const isDirectory = node.type === 'directory';
  const Icon = isDirectory ? (isExpanded ? FolderOpenIcon : FolderIcon) : FileIcon;

  let StatusIcon = null;
  let color = 'var(--fg-secondary)';

  if (node.status === 'added') {
    StatusIcon = FilePlusIcon;
    color = 'var(--mantine-color-green-6)';
  } else if (node.status === 'deleted') {
    StatusIcon = FileMinusIcon;
    color = 'var(--mantine-color-red-6)';
  } else if (node.status === 'modified') {
    StatusIcon = FileDiffIcon;
    color = 'var(--mantine-color-orange-6)';
  }

  const DisplayIcon = !isDirectory && StatusIcon ? StatusIcon : Icon;

  const [hovered, setHovered] = useState(false);

  return (
    <Box>
      {/* Use Box instead of UnstyledButton to avoid nested button issues with ActionIcons */}
      <Box
        className={styles.folderItem}
        onClick={isDirectory ? () => onToggle(node.path) : () => onFileClick?.(node.path)}
        style={{ paddingLeft: 'var(--spacing-xs)', paddingRight: 'var(--spacing-xs)', cursor: 'pointer' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Group gap="xs" wrap="nowrap" w="100%">
          <Box style={{ color, display: 'flex', alignItems: 'center' }}>
            <DisplayIcon size={14} />
          </Box>
          <Text
            size="sm"
            c={node.status === 'deleted' ? 'dimmed' : undefined}
            td={node.status === 'deleted' ? 'line-through' : undefined}
            style={{ fontSize: '13px' }}
            truncate
          >
            {node.name}
          </Text>

          <Group ml="auto" gap={4} wrap="nowrap">
            {hovered && (
              <>
                {isDirectory && (
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="blue"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPublish?.(node.path);
                    }}
                  >
                    <CloudUpload size={12} />
                  </ActionIcon>
                )}
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="red"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDiscard?.(node.path);
                  }}
                >
                  <RotateCcw size={12} />
                </ActionIcon>
              </>
            )}

            {node.stats && (
              <Group gap={2}>
                {node.stats.added > 0 && (
                  <Badge
                    size="xs"
                    color="green"
                    variant="filled"
                    style={{ width: 16, height: 16, fontSize: 9, padding: 0 }}
                  >
                    {node.stats.added}
                  </Badge>
                )}
                {node.stats.modified > 0 && (
                  <Badge
                    size="xs"
                    color="orange"
                    variant="filled"
                    style={{ width: 16, height: 16, fontSize: 9, padding: 0 }}
                  >
                    {node.stats.modified}
                  </Badge>
                )}
                {node.stats.deleted > 0 && (
                  <Badge
                    size="xs"
                    color="red"
                    variant="filled"
                    style={{ width: 16, height: 16, fontSize: 9, padding: 0 }}
                  >
                    {node.stats.deleted}
                  </Badge>
                )}
              </Group>
            )}
            {node.status && (
              <Text size="xs" c="dimmed" style={{ fontSize: '10px' }}>
                {node.status[0].toUpperCase()}
              </Text>
            )}
          </Group>
        </Group>
      </Box>

      {isDirectory && (
        <Collapse in={isExpanded}>
          <Box pl="md" style={{ borderLeft: '1px solid var(--fg-divider)', marginLeft: '11px' }}>
            {node.children && Object.keys(node.children).length > 0 && renderChildren(node.children)}
          </Box>
        </Collapse>
      )}
    </Box>
  );
}
