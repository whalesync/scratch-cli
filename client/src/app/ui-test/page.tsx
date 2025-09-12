'use client';

import { TextTitleXs } from '@/app/components/base/text';
import { PageLayout } from '@/app/components/layouts/PageLayout';
import MainContent from '@/app/components/MainContent';
import { NavToggle } from '@/app/components/NavbarToggle';
import SideBar from '@/app/components/SideBar';
import { Service } from '@/types/server-entities/connector-accounts';
import { ActionIcon, Box, Button, Center, Divider, Group, SegmentedControl, Title } from '@mantine/core';
import { DotsThreeIcon, FileTextIcon, FunnelSimpleIcon, PlusIcon, TableIcon } from '@phosphor-icons/react';
import { JSX } from 'react';
import { ConnectorIcon } from '../components/ConnectorIcon';

const UiTestPage = (): JSX.Element => {
  const footer = <Box p="0">Footer</Box>;
  const aside = (
    <SideBar>
      <SideBar.Header>
        <Title order={5}>SideBar Header</Title>
      </SideBar.Header>
      <SideBar.Body>SideBar Body</SideBar.Body>
    </SideBar>
  );

  return (
    <PageLayout footer={footer} aside={aside}>
      <MainContent>
        <MainContent.Header>
          <Group align="center" h="100%">
            <Group>
              <NavToggle />
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
              <ActionIcon variant="transparent">
                <DotsThreeIcon size={16} />
              </ActionIcon>
            </Group>
          </Group>
        </MainContent.Header>
        <MainContent.Body>Content Body</MainContent.Body>
        <MainContent.Footer>
          <Group h="100%" align="center" gap="xs">
            <Button variant="subtle" size="xs" c="gray.6" leftSection={<PlusIcon size={16} />}>
              Add Row
            </Button>
            <Divider orientation="vertical" size="xs" h="50%" />
            <Button variant="subtle" size="xs" c="gray.6" leftSection={<FunnelSimpleIcon size={16} />}>
              Filter
            </Button>
          </Group>
        </MainContent.Footer>
      </MainContent>
    </PageLayout>
  );
};

export default UiTestPage;
