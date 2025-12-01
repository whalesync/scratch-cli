import { Box, Group, MantineStyleProps, Stack } from '@mantine/core';
import { LucideIcon } from 'lucide-react';
import { JSX, PropsWithChildren } from 'react';
import { WithRequired } from '../../../../utils/utility-types';
import { TextTitle2 } from '../../base/text';
import { DecorativeBoxedIcon } from '../../Icons/DecorativeBoxedIcon';
import classes from './MainContent.module.css';

const MainContent = ({ children, ...styleProps }: PropsWithChildren & MantineStyleProps): JSX.Element => {
  return (
    <Stack p={0} gap={0} w="100%" h="100%" {...styleProps}>
      {children}
    </Stack>
  );
};

type ChildrenWithStyleProps = PropsWithChildren & MantineStyleProps;

const ContentHeader = ({ children, ...styleProps }: ChildrenWithStyleProps): JSX.Element => {
  return (
    <Box className={classes.contentHeader} {...styleProps}>
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

const ContentFooter = ({ children, ...styleProps }: WithRequired<ChildrenWithStyleProps, 'h'>): JSX.Element => {
  return (
    <Box className={classes.contentFooter} {...styleProps}>
      {children}
    </Box>
  );
};

const BasicHeader = ({
  title,
  Icon,
  actions,
}: {
  title?: string;
  Icon?: LucideIcon;
  actions?: React.ReactNode;
}): JSX.Element => {
  return (
    <ContentHeader>
      <Group align="center" h="100%" gap="xs">
        {Icon && <DecorativeBoxedIcon Icon={Icon} />}
        {title && <TextTitle2>{title}</TextTitle2>}
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
