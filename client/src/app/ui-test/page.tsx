'use client';

import { TextRegularXs, TextTitleSm } from '@/app/components/base/text';
import { PageLayout } from '@/app/components/layouts/PageLayout';
import MainContent from '@/app/components/MainContent';
import { NavToggle } from '@/app/components/NavbarToggle';
import SideBar from '@/app/components/SideBar';
import { Box, Group, Title } from '@mantine/core';
import { JSX } from 'react';

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
          <Group align="center">
            <Group>
              <NavToggle />
              <TextTitleSm>Content Area Header</TextTitleSm>
            </Group>
            <Group ml="auto">
              <TextRegularXs>Tool 1</TextRegularXs>
              <TextRegularXs>Tool 2</TextRegularXs>
              <TextRegularXs>Tool 3</TextRegularXs>
            </Group>
          </Group>
        </MainContent.Header>
        <MainContent.Body>Content Body</MainContent.Body>
        <MainContent.Footer>Content Area Footer</MainContent.Footer>
      </MainContent>
    </PageLayout>
  );
};

export default UiTestPage;
