'use client';

import { TextTitleXs } from '@/app/components/base/text';
import MainContent from '@/app/components/layouts/MainContent';
import { PageLayout } from '@/app/components/layouts/PageLayout';
import SideBar from '@/app/components/layouts/SideBarContent';
import { useLayoutManagerStore } from '@/stores/layout-manager-store';
import { Service } from '@/types/server-entities/connector-accounts';
import { ActionIcon, Box, Button, Center, Divider, Group, SegmentedControl, Title } from '@mantine/core';
import { DotsThreeIcon, FileTextIcon, FunnelSimpleIcon, PlusIcon, TableIcon } from '@phosphor-icons/react';
import { JSX } from 'react';
import { ContentFooterButton, PrimaryButton, SecondaryButton } from '../components/base/buttons';
import { ConnectorIcon } from '../components/ConnectorIcon';
import { NavbarToggleButton } from '../components/NavbarToggleButton';

const LayoutTestPage = (): JSX.Element => {
  const { toggleRightPanel } = useLayoutManagerStore();
  const footer = <Box p="0">Footer</Box>;
  const rightPanel = (
    <SideBar>
      <SideBar.Header>
        <Title order={5}>SideBar Header</Title>
      </SideBar.Header>
      <SideBar.Body>SideBar Body</SideBar.Body>
    </SideBar>
  );

  return (
    <PageLayout footer={footer} rightPanel={rightPanel}>
      <MainContent>
        <MainContent.Header>
          <Group align="center" h="100%">
            <Group>
              <NavbarToggleButton />
              <Group gap="xs">
                <ConnectorIcon connector={Service.NOTION} size={24} />
                <TextTitleXs>Blog</TextTitleXs>
              </Group>
              <SegmentedControl
                size="xs"
                styles={{ root: { padding: '2px' } }}
                data={[
                  {
                    value: 'grid',
                    label: (
                      <Center style={{ gap: 5 }}>
                        <TableIcon size={16} />
                        <span>Table</span>
                      </Center>
                    ),
                  },
                  {
                    value: 'record',
                    label: (
                      <Center style={{ gap: 5 }}>
                        <FileTextIcon size={16} />
                        <span>Record</span>
                      </Center>
                    ),
                  },
                ]}
              />
            </Group>

            <Group ml="auto" gap="xs" align="center">
              <ActionIcon variant="transparent" onClick={toggleRightPanel}>
                <DotsThreeIcon size={16} />
              </ActionIcon>
            </Group>
          </Group>
        </MainContent.Header>
        <MainContent.Body>
          <Box c="white" p="md" fw={700}>
            This box has virtual background color, it is pink in dark mode and cyan in light mode
            <Button variant="outline" color="primary">
              Test
            </Button>
            <PrimaryButton>Primary</PrimaryButton>
            <SecondaryButton>Secondary</SecondaryButton>
          </Box>
        </MainContent.Body>
        <MainContent.Footer>
          <Group h="100%" align="center" gap="xs">
            <ContentFooterButton leftSection={<PlusIcon size={16} />}>Add Row</ContentFooterButton>
            <Divider orientation="vertical" size="xs" h="50%" />
            <ContentFooterButton leftSection={<FunnelSimpleIcon size={16} />}>Filter</ContentFooterButton>
          </Group>
        </MainContent.Footer>
      </MainContent>
    </PageLayout>
  );
};

export default LayoutTestPage;
