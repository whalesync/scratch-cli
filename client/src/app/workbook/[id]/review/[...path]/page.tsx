'use client';

import { useParams } from 'next/navigation';
import { ReviewFileViewer } from '../../components/MainPane/ReviewFileViewer';
import type { WorkbookId } from '@spinner/shared-types';

export default function ReviewFilePage() {
  const params = useParams<{ id: string; path: string[] }>();
  const workbookId = params.id as WorkbookId;

  // Decode the path segments and join them
  const filePath = params.path?.map((segment) => decodeURIComponent(segment)).join('/') ?? null;

  return <ReviewFileViewer workbookId={workbookId} filePath={filePath} />;
}
