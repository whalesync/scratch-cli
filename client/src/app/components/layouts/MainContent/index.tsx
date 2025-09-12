import { Box, Group, MantineStyleProps, Stack } from '@mantine/core';
import { JSX, PropsWithChildren } from 'react';
import { TextTitleXs } from '../../base/text';
import { NavToggle } from '../../NavbarToggle';
import classes from './MainContent.module.css';

const MainContent = ({ children }: { children: React.ReactNode }): JSX.Element => {
  return (
    <Stack p={0} gap={0} w="100%" h="100%">
      {children}
    </Stack>
  );
};

type ChildrenWithStyleProps = PropsWithChildren & MantineStyleProps;

const ContentHeader = ({ children, ...styleProps }: ChildrenWithStyleProps): JSX.Element => {
  return (
    <Box h="40px" className={classes.contentHeader} {...styleProps}>
      {children}
    </Box>
  );
};

const ContentBody = ({ children, ...styleProps }: ChildrenWithStyleProps): JSX.Element => {
  return (
    <Box h="100%" w="100%" className={classes.contentBody} {...styleProps}>
      {children}
    </Box>
  );
};

const ContentFooter = ({ children, ...styleProps }: ChildrenWithStyleProps): JSX.Element => {
  return (
    <Box h="40px" className={classes.contentFooter} {...styleProps}>
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
