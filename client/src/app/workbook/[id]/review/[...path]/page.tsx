'use client';

import { useDataFolders } from '@/hooks/use-data-folders';
import type { WorkbookId } from '@spinner/shared-types';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { FolderViewer } from '../../components/MainPane/FolderViewer';
import { ReviewFileViewer } from '../../components/MainPane/ReviewFileViewer';

export default function ReviewFilePage() {
  const params = useParams<{ id: string; path: string[] }>();
  const workbookId = params.id as WorkbookId;
  const { folders } = useDataFolders(workbookId);

  // Decode the path segments
  const pathSegments = useMemo(
    () => params.path?.map((segment) => decodeURIComponent(segment)) ?? [],
    [params.path],
  );
  const filePath = pathSegments.join('/') || null;

  // Check if this path matches a folder (single segment matching a folder name)
  const matchedFolder = useMemo(() => {
    if (pathSegments.length === 1) {
      return folders.find((f) => f.name === pathSegments[0]);
    }
    return null;
  }, [pathSegments, folders]);

  // If path matches a folder, show folder viewer in review mode
  if (matchedFolder) {
    return <FolderViewer workbookId={workbookId} folderId={matchedFolder.id} folderName={matchedFolder.name} mode="review" />;
  }

  return <ReviewFileViewer workbookId={workbookId} filePath={filePath} />;
}
