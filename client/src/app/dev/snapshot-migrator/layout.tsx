import { PageLayout } from '@/app/components/layouts/PageLayout';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <PageLayout>{children}</PageLayout>;
}
