import { Anchor, Button, Code, Group, Loader, Modal, ScrollArea, Select, Stack, Text, ThemeIcon } from '@mantine/core';
import { WorkbookId } from '@spinner/shared-types';
import { ArrowUpIcon, FileIcon, FolderIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { GitFile, workbookApi } from '../../../lib/api/workbook';

interface GitBrowserModalProps {
  workbookId: WorkbookId;
  isOpen: boolean;
  onClose: () => void;
}

export const GitBrowserModal = ({ workbookId, isOpen, onClose }: GitBrowserModalProps) => {
  const [branch, setBranch] = useState<'main' | 'dirty'>('main');
  const [currentPath, setCurrentPath] = useState('');
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [files, setFiles] = useState<GitFile[]>([]);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Define data fetching logic
  const loadFolder = useCallback(
    async (path: string, br: string) => {
      setLoading(true);
      try {
        const list = await workbookApi.listRepoFiles(workbookId, br, path);
        setFiles(
          list.sort((a: GitFile, b: GitFile) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'directory' ? -1 : 1;
          }),
        );
        // Ensure file content is cleared when showing folder
        setFileContent(null);
      } catch (err) {
        console.error(err);
        setFiles([]);
      } finally {
        setLoading(false);
      }
    },
    [workbookId],
  );

  const loadFileContent = useCallback(
    async (path: string, filename: string, br: string) => {
      const filePath = path ? `${path}/${filename}` : filename;
      setLoading(true);
      try {
        const res = await workbookApi.getRepoFile(workbookId, filePath, br);
        setFileContent(res.content);
      } catch (err) {
        console.error(err);
        setFileContent(null); // Clear content if failed (e.g. file doesn't exist in this branch)
      } finally {
        setLoading(false);
      }
    },
    [workbookId],
  );

  // Main Effect: React to state changes (Navigation & Branch Switch)
  useEffect(() => {
    if (!isOpen) return;

    if (currentFile) {
      loadFileContent(currentPath, currentFile, branch);
    } else {
      loadFolder(currentPath, branch);
    }
  }, [isOpen, branch, currentPath, currentFile, loadFolder, loadFileContent]);

  // Reset state on Open
  useEffect(() => {
    if (isOpen) {
      setCurrentPath('');
      setCurrentFile(null);
      setFileContent(null);
      setBranch('main');
      // No need to call load functions here, the Main Effect will trigger due to state changes/isOpen
    }
  }, [isOpen]);

  const handleFolderClick = (folderName: string) => {
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    setCurrentPath(newPath);
  };

  const handleFileClick = (fileName: string) => {
    setCurrentFile(fileName);
  };

  const handleGoUp = () => {
    if (currentFile) {
      setCurrentFile(null);
      return;
    }

    if (!currentPath) return;

    const parts = currentPath.split('/');
    parts.pop();
    const newPath = parts.join('/');
    setCurrentPath(newPath);
  };

  const renderContent = () => {
    if (currentFile && fileContent !== null) {
      return (
        <ScrollArea h={400} type="auto" offsetScrollbars>
          <Code block>{fileContent}</Code>
        </ScrollArea>
      );
    }

    if (currentFile && loading) {
      // While loading file content, show loader or nothing
      return null;
    }

    return (
      <Stack gap={4} h={400} style={{ overflowY: 'auto' }}>
        {files.length === 0 && !loading && (
          <Text c="dimmed" size="sm" p="xs">
            No files
          </Text>
        )}
        {files.map((f) => (
          <Group
            key={f.path}
            gap="xs"
            p={6}
            style={{
              cursor: 'pointer',
              borderRadius: '4px',
            }}
            className="hover:bg-gray-100"
            onClick={() => (f.type === 'directory' ? handleFolderClick(f.name) : handleFileClick(f.name))}
          >
            <ThemeIcon variant="light" color={f.type === 'directory' ? 'blue' : 'gray'} size="sm">
              {f.type === 'directory' ? <FolderIcon size={12} /> : <FileIcon size={12} />}
            </ThemeIcon>
            <Anchor
              component="button"
              type="button"
              size="sm"
              c={f.type === 'directory' ? 'blue' : 'dark'}
              underline="hover"
            >
              {f.name}
            </Anchor>
          </Group>
        ))}
      </Stack>
    );
  };

  return (
    <Modal title="Git Browser" opened={isOpen} onClose={onClose} size="lg">
      <Stack gap="md">
        <Group align="center" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)', paddingBottom: '12px' }}>
          <Select
            value={branch}
            onChange={(val) => setBranch(val as 'main' | 'dirty')}
            data={[
              { label: 'Main', value: 'main' },
              { label: 'Dirty', value: 'dirty' },
            ]}
            w={100}
            size="xs"
            allowDeselect={false}
          />
          <Button
            leftSection={<ArrowUpIcon size={14} />}
            onClick={handleGoUp}
            disabled={!currentPath && !currentFile}
            size="xs"
            variant="default"
          >
            Up
          </Button>
          <Text size="sm" c="dimmed" style={{ fontFamily: 'monospace' }} truncate>
            /{currentPath} {currentFile ? `/${currentFile}` : ''}
          </Text>
        </Group>

        {loading ? (
          <Group justify="center" p="xl">
            <Loader size="sm" />
          </Group>
        ) : (
          renderContent()
        )}
      </Stack>
    </Modal>
  );
};
