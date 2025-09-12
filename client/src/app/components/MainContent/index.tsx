import { Box, Group, Stack } from '@mantine/core';
import { JSX } from 'react';
import { TextTitleXs } from '../base/text';
import { NavToggle } from '../NavbarToggle';
import classes from './MainContent.module.css';

const MainContent = ({ children }: { children: React.ReactNode }): JSX.Element => {
  return (
    <Stack p={0} gap={0} w="100%" h="100%">
      {children}
    </Stack>
  );
};

const ContentHeader = ({ children }: { children: React.ReactNode }): JSX.Element => {
  return (
    <Box h="40px" className={classes.contentHeader}>
      {children}
    </Box>
  );
};

const ContentBody = ({ children }: { children: React.ReactNode }): JSX.Element => {
  return (
    <Box h="100%" w="100%" className={classes.contentBody}>
      {children}
    </Box>
  );
};

const ContentFooter = ({ children }: { children: React.ReactNode }): JSX.Element => {
  return (
    <Box h="40px" className={classes.contentFooter}>
      {children}
    </Box>
  );
};

const BasicHeader = ({ title, actions }: { title?: string; actions?: React.ReactNode }): JSX.Element => {
  return (
    <ContentHeader>
      <Group align="center" h="100%">
        <NavToggle />
        {title && <TextTitleXs>{title}</TextTitleXs>}
        {actions && (
          <Group h="100%" align="center" ml="auto">
            {actions}
          </Group>
        )}
      </Group>
    </ContentHeader>
  );
};

MainContent.Header = ContentHeader;
MainContent.Body = ContentBody;
MainContent.Footer = ContentFooter;
MainContent.BasicHeader = BasicHeader;

export default MainContent;
