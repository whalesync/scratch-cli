'use client';

import { useDevTools } from '@/hooks/use-dev-tools';
import { notFound } from 'next/navigation';

export default function DevSettingsLayout({ children }: { children: React.ReactNode }) {
  const { isDevToolsEnabled } = useDevTools();

  if (!isDevToolsEnabled) {
    return notFound();
  }

  return <>{children}</>;
}
