import { Box, Stack } from '@mantine/core';
import { JSX } from 'react';
import classes from './SideBar.module.css';

const SideBar = ({ children }: { children: React.ReactNode }): JSX.Element => {
  return (
    <Stack p={0} gap={0} w="100%" h="100%">
      {children}
    </Stack>
  );
};

const SideBarHeader = ({ children }: { children: React.ReactNode }): JSX.Element => {
  return (
    <Box h="40px" className={classes.sideBarHeader}>
      {children}
    </Box>
  );
};

const SideBarBody = ({ children }: { children: React.ReactNode }): JSX.Element => {
  return (
    <Box h="100%" w="100%" className={classes.sideBarBody}>
      {children}
    </Box>
  );
};

const SideBarFooter = ({ children }: { children: React.ReactNode }): JSX.Element => {
  return (
    <Box h="40px" className={classes.sideBarFooter}>
      {children}
    </Box>
  );
};

SideBar.Header = SideBarHeader;
SideBar.Body = SideBarBody;
SideBar.Footer = SideBarFooter;

export default SideBar;
