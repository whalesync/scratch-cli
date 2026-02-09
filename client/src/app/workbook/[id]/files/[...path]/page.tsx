'use client';

import { useDataFolders } from '@/hooks/use-data-folders';
import type { WorkbookId } from '@spinner/shared-types';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { FileViewer } from '../../components/MainPane/FileViewer';
import { FolderViewer } from '../../components/MainPane/FolderViewer';

/**
 * Files tab with a specific file or folder selected
 * URL patterns:
 * - /workbook/<id>/files/<tableName> - shows folder contents
 * - /workbook/<id>/files/<tableName>/<file>.json - shows file editor
 */
export default function FileDetailPage() {
  const params = useParams<{ id: string; path: string[] }>();
  const workbookId = params.id as WorkbookId;
  const { folders } = useDataFolders(workbookId);

  // Decode each path segment and rejoin
  const pathSegments = useMemo(
    () => params.path?.map((segment) => decodeURIComponent(segment)) ?? [],
    [params.path],
  );
  const filePath = pathSegments.join('/');

  // Check if this path matches a folder (single segment matching a folder name)
  const matchedFolder = useMemo(() => {
    if (pathSegments.length === 1) {
      return folders.find((f) => f.name === pathSegments[0]);
    }
    return null;
  }, [pathSegments, folders]);

  // If path matches a folder, show folder viewer
  if (matchedFolder) {
    return <FolderViewer workbookId={workbookId} folderId={matchedFolder.id} folderName={matchedFolder.name} />;
  }

  // Otherwise show file viewer
  return <FileViewer workbookId={workbookId} filePath={filePath} />;
}
