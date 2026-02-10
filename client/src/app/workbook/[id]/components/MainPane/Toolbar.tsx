'use client';

import {
  ButtonCompactDanger,
  ButtonCompactPrimary,
  ButtonCompactSecondary,
  IconButtonToolbar,
} from '@/app/components/base/buttons';
import { Text12Medium, Text12Regular } from '@/app/components/base/text';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { useDataFolders } from '@/hooks/use-data-folders';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { dataFolderApi } from '@/lib/api/data-folder';
import { workbookApi } from '@/lib/api/workbook';
import { trackDiscardChanges, trackPublishAll, trackPullFiles, trackToggleDisplayMode } from '@/lib/posthog';
import { useLayoutManagerStore } from '@/stores/layout-manager-store';
import { Box, Breadcrumbs, Group, Tooltip, useMantineColorScheme } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import type { DataFolderId, Workbook } from '@spinner/shared-types';
import { WorkbookId } from '@spinner/shared-types';
import {
  BugIcon,
  ChevronRightIcon,
  CloudUploadIcon,
  DownloadIcon,
  MoonIcon,
  PlusIcon,
  RotateCcwIcon,
  SunIcon,
  TerminalIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfirmDialog, useConfirmDialog } from '@/app/components/modals/ConfirmDialog';
import { ConnectToCLIModal } from '../shared/ConnectToCLIModal';
import { CreateConnectionModal } from '../shared/CreateConnectionModal';
import { DebugMenu } from './DebugMenu';

interface ToolbarProps {
  workbook: Workbook;
}

interface DirtyFile {
  path: string;
  status: 'added' | 'modified' | 'deleted';
}

export function Toolbar({ workbook }: ToolbarProps) {
  const params = useParams<{ id: string; path?: string[] }>();
  const pathname = usePathname();
  const router = useRouter();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const { user } = useScratchPadUser();
  const openReportABugModal = useLayoutManagerStore((state) => state.openReportABugModal);
  const { dataFolderGroups } = useDataFolders(workbook.id);

  const isReviewPage = pathname.includes('/review');
  const isFilesPage = pathname.includes('/files');
  const showBugReport = user?.experimentalFlags?.ENABLE_CREATE_BUG_REPORT;

  // Connection modal state
  const [connectionModalOpened, { open: openConnectionModal, close: closeConnectionModal }] = useDisclosure(false);

  // CLI modal state
  const [cliModalOpened, { open: openCLIModal, close: closeCLIModal }] = useDisclosure(false);

  // Action states
  const [isPulling, setIsPulling] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);

  // Dirty files for review mode
  const [dirtyFiles, setDirtyFiles] = useState<DirtyFile[]>([]);

  // Confirm dialog
  const { open: openConfirmDialog, dialogProps } = useConfirmDialog();

  // Fetch dirty files when in review mode
  useEffect(() => {
    if (!isReviewPage) return;

    const fetchDirtyFiles = async () => {
      try {
        const data = (await workbookApi.getStatus(workbook.id)) as DirtyFile[];
        setDirtyFiles(data || []);
      } catch (error) {
        console.debug('Failed to fetch dirty files:', error);
      }
    };

    fetchDirtyFiles();
  }, [isReviewPage, workbook.id]);

  const handlePullAll = useCallback(async () => {
    setIsPulling(true);
    trackPullFiles(workbook.id);
    try {
      await workbookApi.pullFiles(workbook.id);
      router.refresh();
    } catch (error) {
      console.debug('Failed to pull files:', error);
    } finally {
      setIsPulling(false);
    }
  }, [workbook.id, router]);

  const handlePublishAll = useCallback(() => {
    openConfirmDialog({
      title: 'Publish All Changes',
      message: 'Are you sure you want to publish all changes?',
      confirmLabel: 'Publish',
      variant: 'primary',
      onConfirm: async () => {
        setIsPublishing(true);
        try {
          // Get unique folder names from dirty files
          const dirtyFolderNames = new Set<string>();
          dirtyFiles.forEach((file) => {
            const folderName = file.path.split('/')[0];
            if (folderName) {
              dirtyFolderNames.add(folderName);
            }
          });

          // Find dataFolderIds for dirty folders
          const dataFolderIds: DataFolderId[] = [];
          dataFolderGroups.forEach((group) => {
            group.dataFolders.forEach((folder) => {
              if (dirtyFolderNames.has(folder.name)) {
                dataFolderIds.push(folder.id);
              }
            });
          });

          trackPublishAll(workbook.id, dataFolderIds.length);

          if (dataFolderIds.length > 0) {
            await dataFolderApi.publish(dataFolderIds, workbook.id);
          }

          router.refresh();
        } catch (error) {
          console.debug('Failed to publish changes:', error);
        } finally {
          setIsPublishing(false);
        }
      },
    });
  }, [workbook.id, router, dirtyFiles, dataFolderGroups, openConfirmDialog]);

  const handleDiscardAll = useCallback(() => {
    openConfirmDialog({
      title: 'Discard All Changes',
      message: 'Are you sure you want to discard all unpublished changes? This cannot be undone.',
      confirmLabel: 'Discard',
      variant: 'danger',
      onConfirm: async () => {
        setIsDiscarding(true);
        trackDiscardChanges(workbook.id);
        try {
          await workbookApi.discardChanges(workbook.id);
          router.refresh();
        } catch (error) {
          console.debug('Failed to discard changes:', error);
        } finally {
          setIsDiscarding(false);
        }
      },
    });
  }, [workbook.id, router, openConfirmDialog]);

  const toggleColorScheme = () => {
    const newScheme = colorScheme === 'light' ? 'dark' : 'light';
    setColorScheme(newScheme);
    trackToggleDisplayMode(newScheme);
  };

  // Build breadcrumb from URL path
  // Path structure: TableName/file.json
  // - Workbook root links to /files or /review
  // - Table name (1st segment) links to folder page
  // - File name (2nd segment) links to the file
  const breadcrumbs = useMemo(() => {
    const items: { label: string; href: string }[] = [];

    // Add workbook root - use the appropriate base path
    const basePath = isReviewPage ? 'review' : 'files';
    items.push({
      label: workbook.name ?? 'Workbook',
      href: `/workbook/${params.id}/${basePath}`,
    });

    // Parse the path from URL if present
    if (params.path && params.path.length > 0) {
      const pathParts = params.path;

      pathParts.forEach((part, index) => {
        const decodedPart = decodeURIComponent(part);
        const currentPath = pathParts.slice(0, index + 1).join('/');

        items.push({
          label: decodedPart,
          href: `/workbook/${params.id}/${basePath}/${currentPath}`,
        });
      });
    }

    return items;
  }, [workbook.name, params.id, params.path, isReviewPage]);

  return (
    <Box
      h={40}
      px="sm"
      style={{
        borderBottom: '1px solid var(--fg-divider)',
        backgroundColor: 'var(--bg-selected)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}
    >
      {/* Left: Breadcrumbs */}
      <Group gap="sm">
        <Breadcrumbs
          separator={<StyledLucideIcon Icon={ChevronRightIcon} size="sm" c="var(--fg-muted)" />}
          separatorMargin={4}
        >
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;

            if (isLast) {
              return (
                <Text12Medium key={item.href} c="var(--fg-primary)">
                  {item.label}
                </Text12Medium>
              );
            }

            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                <Text12Regular
                  c="var(--fg-secondary)"
                  style={{
                    cursor: 'pointer',
                  }}
                  __vars={{
                    '--hover-color': 'var(--fg-primary)',
                  }}
                >
                  {item.label}
                </Text12Regular>
              </Link>
            );
          })}
        </Breadcrumbs>
      </Group>

      {/* Right: Action buttons */}
      <Group gap="xs">
        {/* Files mode buttons */}
        {isFilesPage && (
          <>
            <ButtonCompactSecondary leftSection={<PlusIcon size={12} />} onClick={openConnectionModal}>
              Connect service
            </ButtonCompactSecondary>
            <ButtonCompactSecondary
              leftSection={<DownloadIcon size={12} />}
              onClick={handlePullAll}
              loading={isPulling}
            >
              Pull all
            </ButtonCompactSecondary>
          </>
        )}

        {/* Review mode buttons */}
        {isReviewPage && dirtyFiles.length > 0 && (
          <>
            <ButtonCompactPrimary
              leftSection={<CloudUploadIcon size={12} />}
              onClick={handlePublishAll}
              loading={isPublishing}
            >
              Publish all
            </ButtonCompactPrimary>
            <ButtonCompactDanger
              leftSection={<RotateCcwIcon size={12} />}
              onClick={handleDiscardAll}
              loading={isDiscarding}
            >
              Discard all
            </ButtonCompactDanger>
          </>
        )}

        <Tooltip label="Connect to CLI" position="bottom">
          <IconButtonToolbar onClick={openCLIModal} aria-label="Connect to CLI">
            <StyledLucideIcon Icon={TerminalIcon} size="sm" />
          </IconButtonToolbar>
        </Tooltip>
        {showBugReport && (
          <Tooltip label="Report a bug" position="bottom">
            <IconButtonToolbar onClick={openReportABugModal} aria-label="Report a bug">
              <StyledLucideIcon Icon={BugIcon} size="sm" />
            </IconButtonToolbar>
          </Tooltip>
        )}
        <Tooltip label={colorScheme === 'light' ? 'Dark mode' : 'Light mode'} position="bottom">
          <IconButtonToolbar onClick={toggleColorScheme} aria-label="Toggle color scheme">
            <StyledLucideIcon Icon={colorScheme === 'light' ? MoonIcon : SunIcon} size="sm" />
          </IconButtonToolbar>
        </Tooltip>
        <DebugMenu workbookId={workbook.id as WorkbookId} />
      </Group>

      {/* Connection Modal */}
      <CreateConnectionModal
        opened={connectionModalOpened}
        onClose={closeConnectionModal}
        workbookId={workbook.id}
        returnUrl={`/workbook/${workbook.id}/files`}
      />

      {/* CLI Modal */}
      <ConnectToCLIModal opened={cliModalOpened} onClose={closeCLIModal} workbookId={workbook.id} />

      {/* Confirm Dialog */}
      <ConfirmDialog {...dialogProps} />
    </Box>
  );
}
