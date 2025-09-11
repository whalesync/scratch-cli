import SidebarAndContentLayout from './components/layouts/SidebarAndContentLayout';
import { SnapshotsList } from './snapshots/components/SnapshotList';

export default function HomePage() {
  // This page needs to construct the layout itself because the layout.tsx file at this level is not enough.
  return (
    <SidebarAndContentLayout>
      <SnapshotsList />
    </SidebarAndContentLayout>
  );
}
