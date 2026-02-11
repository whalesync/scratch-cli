'use client';

import { trackPageView } from '@/lib/posthog';
import { Box, Stack } from '@mantine/core';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { SettingsHeader } from './components/SettingsHeader';
import { SettingsNav } from './components/SettingsNav';

const SIDEBAR_WIDTH = 220;

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);

  return (
    <Box
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-panel)',
        padding: 6,
      }}
    >
      {/* Sidebar */}
      <Stack
        gap={0}
        style={{
          width: SIDEBAR_WIDTH,
          minWidth: SIDEBAR_WIDTH,
          height: '100%',
          border: '0.5px solid var(--fg-divider)',
          borderRadius: 4,
          backgroundColor: 'var(--bg-base)',
          flexShrink: 0,
        }}
      >
        <SettingsHeader />
        <Box
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
          }}
          py="xs"
        >
          <SettingsNav />
        </Box>
      </Stack>

      {/* Main Content */}
      <Box
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          overflow: 'hidden',
          border: '0.5px solid var(--fg-divider)',
          borderRadius: 4,
          backgroundColor: 'var(--bg-base)',
          marginLeft: 6,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
