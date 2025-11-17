'use client';

import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { getBuildFlavor } from '@/utils/build';
import { RouteUrls } from '@/utils/route-urls';
import { BUILD_VERSION } from '@/version';
import { Group, Stack } from '@mantine/core';
import { DatabaseZap, GalleryVerticalIcon, PickaxeIcon, UsersIcon } from 'lucide-react';
import Link from 'next/link';
import { DevToolButton } from '../components/base/buttons';
import { Text13Book } from '../components/base/text';
import { StyledLucideIcon } from '../components/Icons/StyledLucideIcon';
import MainContent from '../components/layouts/MainContent';

export default function DevListPage() {
  const { user } = useScratchPadUser();
  const jobsEnabled = user?.experimentalFlags?.USE_JOBS ?? false;
  return (
    <MainContent>
      <MainContent.BasicHeader title="Dev tools" />
      <MainContent.Body>
        <Stack gap="md" w="300px">
          <DevToolButton
            component={Link}
            href={RouteUrls.devToolsGalleryPageUrl}
            leftSection={<StyledLucideIcon Icon={GalleryVerticalIcon} size={16} />}
          >
            Component gallery
          </DevToolButton>

          <DevToolButton
            component={Link}
            href={RouteUrls.devToolsJobsPageUrl}
            leftSection={<StyledLucideIcon Icon={PickaxeIcon} size={16} />}
            disabled={!jobsEnabled}
          >
            Jobs
          </DevToolButton>
          <DevToolButton
            component={Link}
            href={RouteUrls.devToolsUsersPageUrl}
            leftSection={<StyledLucideIcon Icon={UsersIcon} size={16} />}
          >
            User Management
          </DevToolButton>

          <DevToolButton
            component={Link}
            href={RouteUrls.devToolsMigrationsPageUrl}
            leftSection={<StyledLucideIcon Icon={DatabaseZap} size={16} />}
          >
            Migrations
          </DevToolButton>
        </Stack>
      </MainContent.Body>
      <MainContent.Footer>
        <Group justify="center">
          <Text13Book c="dimmed">Environment: {getBuildFlavor()}</Text13Book>
          <Text13Book c="dimmed">Build version: {BUILD_VERSION}</Text13Book>
          <Text13Book c="dimmed">Clerk key: {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}</Text13Book>
        </Group>
      </MainContent.Footer>
    </MainContent>
  );
}
