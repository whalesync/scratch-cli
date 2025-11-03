'use client';

import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { getBuildFlavor } from '@/utils/build';
import { RouteUrls } from '@/utils/route-urls';
import { BUILD_VERSION } from '@/version';
import { Group, Stack } from '@mantine/core';
import { DatabaseIcon, DatabaseZapIcon, GalleryVerticalIcon, PickaxeIcon, UsersIcon } from 'lucide-react';
import Link from 'next/link';
import { DevToolButton } from '../components/base/buttons';
import { TextSmBook } from '../components/base/text';
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
            href={RouteUrls.devToolsSnapshotMigratorPageUrl}
            leftSection={<StyledLucideIcon Icon={DatabaseIcon} size={16} />}
          >
            Snapshot Migration Tool
          </DevToolButton>
          <DevToolButton
            component={Link}
            href={'/dev/upload-migrator'}
            leftSection={<StyledLucideIcon Icon={DatabaseZapIcon} size={16} />}
          >
            Upload schema migration Tool
          </DevToolButton>
        </Stack>
      </MainContent.Body>
      <MainContent.Footer>
        <Group justify="center">
          <TextSmBook c="dimmed">Environment: {getBuildFlavor()}</TextSmBook>
          <TextSmBook c="dimmed">Build version: {BUILD_VERSION}</TextSmBook>
          <TextSmBook c="dimmed">Clerk key: {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}</TextSmBook>
        </Group>
      </MainContent.Footer>
    </MainContent>
  );
}
