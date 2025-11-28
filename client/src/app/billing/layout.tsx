import { PageLayout } from '@/app/components/layouts/PageLayout';

export default function BasicLayout({ children }: { children: React.ReactNode }) {
  return <PageLayout>{children}</PageLayout>;
}
