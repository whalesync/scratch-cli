'use client';

import { useParams } from 'next/navigation';
import type { WorkbookId } from '@spinner/shared-types';
import { FileViewer } from '../../components/MainPane/FileViewer';

/**
 * Files tab with a specific file selected
 * URL: /n/workbooks/<id>/files/<connection>/<table>/<file>.json
 */
export default function FileDetailPage() {
  const params = useParams<{ id: string; path: string[] }>();
  const workbookId = params.id as WorkbookId;
  // Decode each path segment and rejoin
  const filePath = params.path?.map((segment) => decodeURIComponent(segment)).join('/') ?? '';

  return <FileViewer workbookId={workbookId} filePath={filePath} />;
}
