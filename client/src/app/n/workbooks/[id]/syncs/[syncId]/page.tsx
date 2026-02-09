'use client';

import { useParams } from 'next/navigation';
import { SyncEditor } from '../../components/MainPane/SyncEditor';
import type { SyncId, WorkbookId } from '@spinner/shared-types';

export default function SyncDetailPage() {
  const params = useParams<{ id: string; syncId: string }>();
  const workbookId = params.id as WorkbookId;
  const syncId = params.syncId as SyncId;

  return <SyncEditor workbookId={workbookId} syncId={syncId} />;
}
