import { Box, MantineStyleProps, Paper } from '@mantine/core';
import { JSX, PropsWithChildren, RefObject } from 'react';
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

type SideBarContentBodyProps = { scrollRef?: RefObject<HTMLDivElement | null> } & PropsWithChildren;

const SideBarContentBody = ({ children, scrollRef, ...styleProps }: SideBarContentBodyProps): JSX.Element => {
  return (
    <Box w="100%" h="100%" className={classes.sideBarBody} {...styleProps} ref={scrollRef}>
      {children}
    </Box>
  );
};

const SideBarContentBottom = ({ children, ...styleProps }: ChildrenWithStyleProps): JSX.Element => {
  return (
    <Box mih="150px" className={classes.sideBarFooter} {...styleProps}>
      {children}
    </Box>
  );
};
SideBarContent.Header = SideBarContentHeader;
SideBarContent.Body = SideBarContentBody;
SideBarContent.Bottom = SideBarContentBottom;
export default SideBarContent;
