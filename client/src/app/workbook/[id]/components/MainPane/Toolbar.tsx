'use client';

import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { Text12Medium, Text12Regular } from '@/app/components/base/text';
import { Box, Breadcrumbs, Group } from '@mantine/core';
import type { Workbook } from '@spinner/shared-types';
import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useMemo } from 'react';

interface ToolbarProps {
  workbook: Workbook;
}

export function Toolbar({ workbook }: ToolbarProps) {
  const params = useParams<{ id: string; path?: string[] }>();
  const pathname = usePathname();

  const isReviewPage = pathname.includes('/review');

  // Build breadcrumb from URL path
  const breadcrumbs = useMemo(() => {
    const items: { label: string; href: string }[] = [];

    // Add workbook root - use the appropriate base path
    const basePath = isReviewPage ? 'review' : 'files';
    items.push({
      label: workbook.name ?? 'Workbook',
      href: `/workbook/${params.id}/${basePath}`,
    });

    // Parse the path from URL if present
    if (params.path && params.path.length > 0) {
      const pathParts = params.path;
      let currentPath = '';

      pathParts.forEach((part) => {
        currentPath += (currentPath ? '/' : '') + part;
        items.push({
          label: decodeURIComponent(part),
          href: `/workbook/${params.id}/${basePath}/${currentPath}`,
        });
      });
    }

    return items;
  }, [workbook.name, params.id, params.path, isReviewPage]);

  return (
    <Box
      h={40}
      px="sm"
      style={{
        borderBottom: '1px solid var(--fg-divider)',
        backgroundColor: 'var(--bg-selected)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}
    >
      {/* Left: Breadcrumbs */}
      <Group gap="sm">
        <Breadcrumbs
          separator={<StyledLucideIcon Icon={ChevronRightIcon} size="sm" c="var(--fg-muted)" />}
          separatorMargin={4}
        >
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1;

            if (isLast) {
              return (
                <Text12Medium key={item.href} c="var(--fg-primary)">
                  {item.label}
                </Text12Medium>
              );
            }

            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                <Text12Regular
                  c="var(--fg-secondary)"
                  style={{
                    cursor: 'pointer',
                  }}
                  __vars={{
                    '--hover-color': 'var(--fg-primary)',
                  }}
                >
                  {item.label}
                </Text12Regular>
              </Link>
            );
          })}
        </Breadcrumbs>
      </Group>

      {/* Right: Action buttons (contextual based on selection) */}
      <Group gap="xs">
        {/* Buttons moved to sidebar */}
      </Group>
    </Box>
  );
}
