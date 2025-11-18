'use client';

import { PageLayout } from '@/app/components/layouts/PageLayout';
import { WorkbooksList } from './components/WorkbooksList';

export default function SnapshotsListPage() {
  return (
    <PageLayout>
      <WorkbooksList />
    </PageLayout>
  );
}
