'use client';

import type { SyncId, WorkbookId } from '@spinner/shared-types';
import { useParams } from 'next/navigation';
import { SyncEditor } from '../../components/MainPane/SyncEditor';

export default function SyncDetailPage() {
  const params = useParams<{ id: string; syncId: string }>();
  const workbookId = params.id as WorkbookId;
  const syncId = params.syncId as SyncId;

  return <SyncEditor workbookId={workbookId} syncId={syncId} />;
}
