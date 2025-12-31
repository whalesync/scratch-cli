'use client';

import { getBuildFlavor } from '@/utils/build';
import { RouteUrls } from '@/utils/route-urls';
import { BUILD_VERSION } from '@/version';
import { Group, Stack, Title } from '@mantine/core';
import { Tree, type NodeModel } from '@minoru/react-dnd-treeview';
import { DatabaseZap, GalleryVerticalIcon, Grid2x2Icon, PickaxeIcon, UsersIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { DevToolButton } from '../components/base/buttons';
import { Text13Book } from '../components/base/text';
import { StyledLucideIcon } from '../components/Icons/StyledLucideIcon';
import MainContent from '../components/layouts/MainContent';

const initialData = [
  {
    id: 1,
    parent: 0,
    droppable: true,
    text: 'Folder 1',
  },
  {
    id: 2,
    parent: 1,
    text: 'File 1-1',
  },
  {
    id: 3,
    parent: 1,
    text: 'File 1-2',
  },
  {
    id: 4,
    parent: 0,
    droppable: true,
    text: 'Folder 2',
  },
  {
    id: 5,
    parent: 4,
    droppable: true,
    text: 'Folder 2-1',
  },
  {
    id: 6,
    parent: 5,
    text: 'File 2-1-1',
  },
];

export default function DevListPage() {
  const [treeData, setTreeData] = useState(initialData);
  const handleDrop = (newTreeData: NodeModel[]) => setTreeData(newTreeData as typeof initialData);

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
            href={RouteUrls.devToolsGridPageUrl}
            leftSection={<StyledLucideIcon Icon={Grid2x2Icon} size={16} />}
          >
            Grid playground
          </DevToolButton>

          <DevToolButton
            component={Link}
            href={RouteUrls.devToolsJobsPageUrl}
            leftSection={<StyledLucideIcon Icon={PickaxeIcon} size={16} />}
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

        <Title>RYDER</Title>
        <Tree
          tree={treeData}
          rootId={0}
          onDrop={handleDrop}
          render={(node, { depth, isOpen, onToggle }) => (
            <div style={{ marginLeft: depth * 10 }}>
              {node.droppable && <span onClick={onToggle}>{isOpen ? '[-]' : '[+]'}</span>}
              {node.text}
            </div>
          )}
        />
      </MainContent.Body>
      <MainContent.Footer h={28}>
        <Group justify="center">
          <Text13Book c="dimmed">Environment: {getBuildFlavor()}</Text13Book>
          <Text13Book c="dimmed">Build version: {BUILD_VERSION}</Text13Book>
          <Text13Book c="dimmed">Clerk key: {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}</Text13Book>
        </Group>
      </MainContent.Footer>
    </MainContent>
  );
}
