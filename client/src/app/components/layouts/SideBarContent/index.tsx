import { Box, MantineStyleProps, Paper, Stack } from '@mantine/core';
import { JSX, PropsWithChildren } from 'react';
import classes from './SideBarContent.module.css';

type ChildrenWithStyleProps = PropsWithChildren & MantineStyleProps;

const SideBarContent = ({ children }: { children: React.ReactNode }): JSX.Element => {
  return (
    <Paper
      h="100%"
      style={{
        display: 'flex',
        flexDirection: 'column',
      }}
      p={0}
    >
      {children}
    </Paper>
  );
};

const SideBarContentHeader = ({ children, ...styleProps }: ChildrenWithStyleProps): JSX.Element => {
  return (
    <Box h="40px" className={classes.sideBarHeader} {...styleProps}>
      {children}
    </Box>
  );
};

const SideBarContentBody = ({ children, ...styleProps }: ChildrenWithStyleProps): JSX.Element => {
  return (
    <Stack h="100%" w="100%" className={classes.sideBarBody} {...styleProps}>
      {children}
    </Stack>
  );
};

const SideBarContentBottom = ({ children, ...styleProps }: ChildrenWithStyleProps): JSX.Element => {
  return (
    <Box h="140px" className={classes.sideBarFooter} {...styleProps}>
      {children}
    </Box>
  );
};
SideBarContent.Header = SideBarContentHeader;
SideBarContent.Body = SideBarContentBody;
SideBarContent.Bottom = SideBarContentBottom;
export default SideBarContent;
