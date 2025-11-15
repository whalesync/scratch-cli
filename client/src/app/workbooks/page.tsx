'use client';

import { PageLayout } from '@/app/components/layouts/PageLayout';
import { SnapshotsList } from './components/SnapshotList';

export default function SnapshotsListPage() {
  return (
    <PageLayout>
      <SnapshotsList />
    </PageLayout>
  );
}
