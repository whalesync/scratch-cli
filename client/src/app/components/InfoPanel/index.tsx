import { Anchor, Box, Center, CenterProps, Collapse, Group, GroupProps, Stack, Text, TextProps } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  CircleAlertIcon,
  FileTextIcon,
  GhostIcon,
  LucideIcon,
  PlusIcon,
  RotateCw,
  SquareArrowOutUpRight,
} from 'lucide-react';
import { JSX, PropsWithChildren, ReactNode } from 'react';
import { ButtonPrimaryLight, ButtonSecondaryOutline } from '../base/buttons';
import { Text13Book, Text13Medium } from '../base/text';
import { DecorativeBoxedIcon } from '../Icons/DecorativeBoxedIcon';
import styles from './Info.module.css';

const INFO_PANEL_MAX_WIDTH = 400;

/*
 A general information panel that can be used for not-found, empty, or error states.

 Designed to fill in an area and center some content, with a title, description, and optional actions.

 Assemble the stack with an icon, title, description, and actions. 
*/
export const Info = ({ children, ...props }: CenterProps): JSX.Element => {
  return (
    <Center {...props} m="xl">
      <Stack align="center" maw={INFO_PANEL_MAX_WIDTH} gap="0px">
        {children}
      </Stack>
    </Center>
  );
};

const InfoIcon = ({ Icon }: { Icon: LucideIcon }): JSX.Element => {
  return (
    <Box mb="16px">
      <DecorativeBoxedIcon Icon={Icon} size="sm" />
    </Box>
  );
};

const ErrorIcon = (): JSX.Element => {
  return (
    <Box mb="16px">
      <DecorativeBoxedIcon Icon={CircleAlertIcon} size="sm" c="var(--mantine-color-red-8)" />
    </Box>
  );
};

const NotFoundIcon = (): JSX.Element => {
  return (
    <Box mb="16px">
      <DecorativeBoxedIcon Icon={GhostIcon} size="sm" c="var(--fg-muted)" />
    </Box>
  );
};

const FileIcon = (): JSX.Element => {
  return (
    <Box mb="16px">
      <DecorativeBoxedIcon Icon={FileTextIcon} size="sm" c="var(--fg-muted)" />
    </Box>
  );
};

const Title = ({ children, ...props }: PropsWithChildren<TextProps>): JSX.Element => {
  return (
    <Text13Medium mb="2px" {...props}>
      {children}
    </Text13Medium>
  );
};

const Description = ({ children, ...props }: PropsWithChildren<TextProps>): JSX.Element => {
  return (
    <Text13Book ta="center" {...props}>
      {children}
    </Text13Book>
  );
};

/*
  A button that links to the documentation. By default it goes to the quick-start guide.
  @param link - The link to go to.
*/
const ViewDocsButton = ({ link }: { link?: string }): JSX.Element => {
  const docsLink = link || 'https://docs.scratch.md/';
  return (
    <ButtonSecondaryOutline
      href={docsLink}
      leftSection={<SquareArrowOutUpRight />}
      component="a"
      size="xs"
      target="_blank"
    >
      Read docs
    </ButtonSecondaryOutline>
  );
};

const ReloadPageButton = (): JSX.Element => {
  return (
    <ButtonPrimaryLight size="xs" leftSection={<RotateCw size={16} />} onClick={() => window.location.reload()}>
      Reload
    </ButtonPrimaryLight>
  );
};

const AddEntityButton = ({ label, onClick }: { label: string; onClick: () => void }): JSX.Element => {
  return (
    <ButtonPrimaryLight leftSection={<PlusIcon size={16} />} onClick={onClick} size="xs">
      {label}
    </ButtonPrimaryLight>
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

Info.Icon = InfoIcon;
Info.NotFoundIcon = NotFoundIcon;
Info.ErrorIcon = ErrorIcon;
Info.FileIcon = FileIcon;

Info.Title = Title;
Info.Description = Description;
Info.Actions = Actions;

Info.ViewDocsButton = ViewDocsButton;
Info.AddEntityButton = AddEntityButton;
Info.ReloadPageButton = ReloadPageButton;

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
}) => {
  return (
    <Info>
      <Info.ErrorIcon />
      <Info.Title>{title}</Info.Title>
      {!!error && <Info.DetailsDisclosure>{`${error}`}</Info.DetailsDisclosure>}
      <Info.Actions>
        {retry && (
          <ButtonPrimaryLight leftSection={<RotateCw size={16} />} onClick={retry} size="xs">
            Reload
          </ButtonPrimaryLight>
        )}
        {action}
      </Info.Actions>
    </Info>
  );
};

export const EmptyListInfoPanel = ({
  title,
  description,
  docsLink,
  actionButton,
}: {
  title: string;
  description: string;
  docsLink?: string;
  actionButton?: ReactNode;
}) => {
  return (
    <Info>
      <Info.NotFoundIcon />
      <Info.Title>{title}</Info.Title>
      <Info.Description>{description}</Info.Description>
      <Info.Actions>
        {docsLink && <ViewDocsButton link={docsLink} />}
        {actionButton}
      </Info.Actions>
    </Info>
  );
};
