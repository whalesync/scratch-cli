'use client';

import { PageLayout } from '@/app/components/layouts/PageLayout';
import { notFound } from 'next/navigation';
import { useDevTools } from '../../hooks/use-dev-tools';

export default function BasicLayout({ children }: { children: React.ReactNode }) {
  const { isDevToolsEnabled } = useDevTools();

  if (!isDevToolsEnabled) {
    return notFound();
  }

  return <PageLayout>{children}</PageLayout>;
}
