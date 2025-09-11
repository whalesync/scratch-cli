import { Box, Stack } from '@mantine/core';
import { JSX } from 'react';
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

MainContent.Header = ContentHeader;
MainContent.Body = ContentBody;
MainContent.Footer = ContentFooter;

export default MainContent;
