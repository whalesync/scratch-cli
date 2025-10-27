import {
  ActionIcon,
  ActionIconProps,
  Anchor,
  Box,
  Button,
  Center,
  CenterProps,
  Collapse,
  Group,
  GroupProps,
  Loader,
  Stack,
  Text,
  TextProps,
  TitleProps,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { ArrowsClockwiseIcon, ArrowUpRightIcon, InfoIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import Link from 'next/link';
import { JSX, PropsWithChildren, ReactNode } from 'react';
import { ButtonPrimaryLight } from '../base/buttons';
import { TextRegularSm, TextTitle2 } from '../base/text';
import styles from './Info.module.css';

/*
 A general information panel that can be used for not-found, empty, or error states.

 Designed to fill in an area and center some content, with a title, description, and optional actions.

 Assemble the stack with an icon, title, description, and actions. 
*/
export const Info = ({ children, ...props }: CenterProps): JSX.Element => {
  return (
    <Center h="100%" w="100%" {...props}>
      <Stack align="center" maw="300px" gap="0px" className={styles.container}>
        {children}
      </Stack>
    </Center>
  );
};

const Icon = (props: ActionIconProps): JSX.Element => {
  return <ActionIcon {...props} variant="light" style={{ pointerEvents: 'none' }} mb="sm" />;
};

const ErrorIcon = (): JSX.Element => {
  return (
    <ActionIcon color="red" variant="light" style={{ pointerEvents: 'none' }} mb="sm">
      <InfoIcon />
    </ActionIcon>
  );
};

const NotFoundIcon = (): JSX.Element => {
  return (
    <ActionIcon color="gray" variant="light" style={{ pointerEvents: 'none' }} mb="sm">
      <MagnifyingGlassIcon />
    </ActionIcon>
  );
};

const LoaderWidget = (): JSX.Element => {
  return <Loader size="lg" mb="sm" color="primary" />;
};

const Title = ({ children, ...props }: PropsWithChildren<TitleProps>): JSX.Element => {
  return (
    <TextTitle2 mb="2px" {...props}>
      {children}
    </TextTitle2>
  );
};

const Description = ({ children, ...props }: PropsWithChildren<TextProps>): JSX.Element => {
  return <TextRegularSm {...props}>{children}</TextRegularSm>;
};

const StatusPageDescription = (): JSX.Element => {
  return (
    <Description>
      An error has occured. If the error persists, please visit our{' '}
      <Link href="https://docs.whalesync.com/resources/support" target="_blank">
        Support Page
      </Link>
    </Description>
  );
};

/*
  A button that links to the documentation. By default it goes to the quick-start guide.
  @param link - The link to go to.
*/
const ReadDocsButton = ({ link }: { link?: string }): JSX.Element => {
  const docsLink = link || 'https://docs.whalesync.com/start-here/quick-start';
  return (
    <Button
      href={docsLink}
      leftSection={<ArrowUpRightIcon />}
      variant="outline"
      component="a"
      size="sm"
      target="_blank"
    >
      Read docs
    </Button>
  );
};

const Actions = ({ children, ...props }: PropsWithChildren<GroupProps>): JSX.Element => {
  return (
    <Group gap="sm" mt="md" {...props} justify="center" align="center">
      {children}
    </Group>
  );
};

const DetailsDisclosure = ({ children }: { children: ReactNode }): JSX.Element => {
  const [detailsVisible, { toggle: toggleDetails }] = useDisclosure(false);
  return (
    <Stack m="xs" gap="xs">
      <Anchor underline="always" className={styles.dashedLink} onClick={toggleDetails}>
        {detailsVisible ? 'Hide details' : 'Show details'}
      </Anchor>

      <Collapse in={detailsVisible}>
        <Box w={500} mah={400} p="md" bg="var(--mantine-color-red-light)">
          <Text size="xs">{children}</Text>
        </Box>
      </Collapse>
    </Stack>
  );
};

Info.Icon = Icon;
Info.NotFoundIcon = NotFoundIcon;
Info.ErrorIcon = ErrorIcon;
Info.Loader = LoaderWidget;
Info.Title = Title;
Info.Description = Description;
Info.StatusPageDescription = StatusPageDescription;
Info.Actions = Actions;
Info.ReadDocsButton = ReadDocsButton;
Info.DetailsDisclosure = DetailsDisclosure;

export const ErrorInfo = ({
  error,
  retry,
  action,
  title,
}: {
  error?: unknown;
  retry?: () => void;
  action?: ReactNode;
  title?: ReactNode;
}): ReactNode => {
  return (
    <Info>
      <Info.ErrorIcon />
      <Info.Title>{title}</Info.Title>
      <Info.StatusPageDescription />
      {!!error && <Info.DetailsDisclosure>{`${error}`}</Info.DetailsDisclosure>}
      <Info.Actions>
        {retry && (
          <ButtonPrimaryLight leftSection={<ArrowsClockwiseIcon />} onClick={retry}>
            Reload
          </ButtonPrimaryLight>
        )}
        {action}
      </Info.Actions>
    </Info>
  );
};
