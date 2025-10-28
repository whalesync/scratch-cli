'use client';

import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { RouteUrls } from '@/utils/route-urls';
import { BUILD_VERSION } from '@/version';
import { Stack } from '@mantine/core';
import { DatabaseIcon, GalleryVerticalIcon, PickaxeIcon, UsersIcon } from 'lucide-react';
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
        </Stack>
      </MainContent.Body>
      <MainContent.Footer>
        <TextSmBook c="dimmed" ta="center">
          Build version: {BUILD_VERSION}
        </TextSmBook>
      </MainContent.Footer>
    </MainContent>
  );
}
