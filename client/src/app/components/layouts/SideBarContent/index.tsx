import { Box, Paper, Stack } from '@mantine/core';
import { JSX } from 'react';
import classes from './SideBarContent.module.css';

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

const SideBarContentHeader = ({ children }: { children: React.ReactNode }): JSX.Element => {
  return (
    <Box h="40px" className={classes.sideBarHeader}>
      {children}
    </Box>
  );
};

const SideBarContentBody = ({ children }: { children: React.ReactNode }): JSX.Element => {
  return (
    <Stack h="100%" w="100%" className={classes.sideBarBody} flex={1}>
      {children}
    </Stack>
  );
};

SideBarContent.Header = SideBarContentHeader;
SideBarContent.Body = SideBarContentBody;

export default SideBarContent;
