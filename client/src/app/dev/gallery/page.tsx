'use client';

import { DiffText2 } from '@/app/components/DiffText2';
import { DiffViewer } from '@/app/components/DiffViewer';
import { LabelValuePair } from '@/app/components/LabelValuePair';
import MainContent from '@/app/components/layouts/MainContent';
import {
  Anchor,
  Badge,
  Box,
  Code,
  ColorSwatch,
  Divider,
  Group,
  Kbd,
  List,
  Loader,
  Menu,
  Stack,
  Tooltip,
  useComputedColorScheme,
} from '@mantine/core';
import {
  AlignEndHorizontal,
  Ambulance,
  Bird,
  CircleCheck,
  FigmaIcon,
  Home,
  MoonStar,
  Plus,
  Settings,
  Trash2,
} from 'lucide-react';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Service } from '../../../types/server-entities/connector-accounts';
import { AnimatedArrowsClockwise } from '../../components/AnimatedArrowsClockwise';
import { ActionIconThreeDots } from '../../components/base/action-icons';
import { BadgeError, BadgeOK } from '../../components/base/badges';
import {
  AcceptSuggestionButton,
  ButtonDangerLight,
  ButtonPrimaryLight,
  ButtonPrimarySolid,
  ButtonSecondaryGhost,
  ButtonSecondaryInline,
  ButtonSecondaryOutline,
  ButtonSecondarySolid,
  ContentFooterButton,
  DevToolButton,
  IconButtonGhost,
  IconButtonInline,
  IconButtonOutline,
  RejectSuggestionButton,
} from '../../components/base/buttons';
import {
  Text12Book,
  Text12Medium,
  Text12Regular,
  Text13Book,
  Text13Medium,
  Text13Regular,
  Text16Book,
  Text16Medium,
  Text16Regular,
  TextMonoSmRegular,
  TextMonoXsRegular,
  TextTitle1,
  TextTitle2,
  TextTitle3,
  TextTitle4,
} from '../../components/base/text';
import { CloseButtonInline } from '../../components/CloseButtonInline';
import { ConnectorIcon } from '../../components/ConnectorIcon';
import { DebouncedTextArea } from '../../components/DebouncedTextArea';
import { DotSpacer } from '../../components/DotSpacer';
import { DecorativeBoxedIcon } from '../../components/Icons/DecorativeBoxedIcon';
import { StyledLucideIcon } from '../../components/Icons/StyledLucideIcon';
import { ErrorInfo, Info } from '../../components/InfoPanel';
import { LoaderWithMessage } from '../../components/LoaderWithMessage';
import { RelativeDate } from '../../components/RelativeDate';
import { ToolIconButton } from '../../components/ToolIconButton';

export default function DevComponentGalleryPage() {
  return (
    <MainContent>
      <MainContent.BasicHeader title="Dev tools - Component gallery" />
      <MainContent.Body>
        <Stack w="100%" p="md">
          <Text13Regular>This is a gallery of components that are available in the application</Text13Regular>
          {/* Table of contents */}
          <List>
            <List.Item>
              <Anchor href="#shades">Key shades</Anchor>
            </List.Item>
            <List.Item>
              <Anchor href="#colors">Colors</Anchor>
            </List.Item>
            <List.Item>
              <Anchor href="#title-text">Text: title</Anchor>
            </List.Item>
            <List.Item>
              <Anchor href="#body-text">Text: body</Anchor>
            </List.Item>
            <List.Item>
              <Anchor href="#mono-text">Text: monospace</Anchor>
            </List.Item>
            <List.Item>
              <Anchor href="#buttons">Buttons</Anchor>
            </List.Item>
            <List.Item>
              <Anchor href="#action-icons">Action Icons</Anchor>
            </List.Item>
            <List.Item>
              <Anchor href="#badges">Badges</Anchor>
            </List.Item>
            <List.Item>
              <Anchor href="#loaders">Loaders</Anchor>
            </List.Item>
            <List.Item>
              <Anchor href="#icons">Icons</Anchor>
            </List.Item>
            <List.Item>
              <Anchor href="#formatting">Formatting</Anchor>
            </List.Item>
            <List.Item>
              <Anchor href="#info-panels">Info Panels</Anchor>
            </List.Item>
            <List.Item>
              <Anchor href="#input-components">Input Components</Anchor>
            </List.Item>
            <List.Item>
              <Anchor href="#dev-tool-components">Dev Tool Components</Anchor>
            </List.Item>
          </List>
          <GallerySection id="shades" title="Key shades" />
          <Text12Book c="dimmed">
            These are single-color shades that adjust for light/dark mode. Use these for all panels and text.
          </Text12Book>
          <GalleryItem label="Background: base" notes="Main body/page background color">
            <ColorChip cssName="--bg-base" modeAware />
          </GalleryItem>
          <GalleryItem
            label="Background: panel"
            notes="Use this for elevated background region of panels and cards. AKA --mantine-color-gray-0, or Figma grey/1"
          >
            <ColorChip cssName="--bg-panel" modeAware />
          </GalleryItem>
          <GalleryItem
            label="Background: selected"
            notes="Use this as background for selected items. AKA --mantine-color-gray-1, or Figma grey/2"
          >
            <ColorChip cssName="--bg-selected" modeAware />
          </GalleryItem>
          <GalleryItem
            label="Foreground: primary"
            notes="Use for all main text. AKA --mantine-color-gray-9, or Figma grey/12"
          >
            <ColorChip cssName="--fg-primary" modeAware />
          </GalleryItem>
          <GalleryItem
            label="Foreground: secondary"
            notes="Use for secondary text: table headers, . AKA --mantine-color-gray-8, or Figma grey/11"
          >
            <ColorChip cssName="--fg-secondary" modeAware />
          </GalleryItem>
          <GalleryItem
            label="Foreground: muted"
            notes="Tertiary text, most toolbars or decorative icons. AKA --mantine-color-gray-7, or Figma grey/10"
          >
            <ColorChip cssName="--fg-muted" modeAware />
          </GalleryItem>
          <GallerySection id="colors" title="Colors" />
          <Text12Book c="dimmed">
            These are the full 10-shade colors from Mantine. Their numbers don&apos;t exactly match the design system,
            because Mantine only supports 10 shades. Mostly use the shades above instead.
          </Text12Book>
          <GalleryColor
            color="green"
            modeAware
            notes="AKA primary. Can be used in light or dark for emphasis"
            figmaNames={[
              'green/1',
              'green/2',
              'green/3',
              'green/4',
              'green/6',
              'green/7',
              'green/9',
              'green/10',
              'green/11',
              'green/12',
            ]}
          />

          <GalleryColor
            color="gray"
            modeAware
            figmaNames={[
              'gray/1',
              'gray/2',
              'gray/3',
              'gray/4',
              'gray/6',
              'gray/7',
              'gray/9',
              'gray/10',
              'gray/11',
              'gray/12',
            ]}
          />
          <GalleryColor
            color="red"
            modeAware
            figmaNames={['red/1', 'red/2', 'red/3', 'red/4', 'red/6', 'red/7', 'red/9', 'red/10', 'red/11', 'red/12']}
          />
          <GalleryColor color="blue" />
          <GalleryColor color="devTool" notes="Use for anything dev-only." />

          <GallerySection id="title-text" title="Text: title" />
          <TypeGalleryItem label="TextTitle1" notes="AKA title/24">
            <TextTitle1>Brown fox is quick</TextTitle1>
          </TypeGalleryItem>
          <TypeGalleryItem label="TextTitle2" notes="AKA title/18">
            <TextTitle2>Brown fox is quick</TextTitle2>
          </TypeGalleryItem>
          <TypeGalleryItem label="TextTitle3" notes="AKA title/16">
            <TextTitle3>Brown fox is quick</TextTitle3>
          </TypeGalleryItem>
          <TypeGalleryItem label="TextTitle4" notes="AKA title/14">
            <TextTitle4>Brown fox is quick</TextTitle4>
          </TypeGalleryItem>

          <GallerySection id="body-text" title="Text: body" />
          <Text12Book c="dimmed">All of these support c=&apos;dimmed&apos;</Text12Book>
          <TypeGalleryItem label="Text16Medium" notes="AKA text/16-medium">
            <Text16Medium>Brown fox is quick</Text16Medium>
          </TypeGalleryItem>
          <TypeGalleryItem label="Text16Regular" notes="AKA text/16-regular">
            <Text16Regular>Brown fox is quick</Text16Regular>
          </TypeGalleryItem>
          <TypeGalleryItem label="Text16Book" notes="AKA text/16-book">
            <Text16Book>Brown fox is quick</Text16Book>
          </TypeGalleryItem>
          <TypeGalleryItem label="Text13Medium" notes="AKA text/13-medium">
            <Text13Medium>Brown fox is quick</Text13Medium>
          </TypeGalleryItem>
          <TypeGalleryItem label="Text13Regular" notes="AKA text/13-regular">
            <Text13Regular>Brown fox is quick</Text13Regular>
          </TypeGalleryItem>
          <TypeGalleryItem label="Text13Book" notes="AKA text/13-book">
            <Text13Book>Brown fox is quick</Text13Book>
          </TypeGalleryItem>
          <TypeGalleryItem label="Text12Medium" notes="AKA text/12-medium">
            <Text12Medium>Brown fox is quick</Text12Medium>
          </TypeGalleryItem>
          <TypeGalleryItem label="Text12Regular" notes="AKA text/12-regular">
            <Text12Regular>Brown fox is quick</Text12Regular>
          </TypeGalleryItem>
          <TypeGalleryItem label="Text12Book" notes="AKA text/12-book">
            <Text12Book>Brown fox is quick</Text12Book>
          </TypeGalleryItem>
          <TypeGalleryItem label="Text12Book c='dimmed'">
            <Text12Book c="dimmed">Brown fox is quick</Text12Book>
          </TypeGalleryItem>
          <GalleryItem label="DotSpacer">
            <Group gap={0}>
              <Text13Regular>Item 1</Text13Regular>
              <DotSpacer />
              <Text13Regular>Item 2</Text13Regular>
            </Group>
          </GalleryItem>
          <GallerySection id="mono-text" title="Text: monospace" />
          <TypeGalleryItem label="TextMonoSmRegular" notes="AKA mono/13-regular">
            <TextMonoSmRegular>Brown fox is quick</TextMonoSmRegular>
          </TypeGalleryItem>
          <TypeGalleryItem label="TextMonoRegularXs" notes="AKA mono/12-regular">
            <TextMonoXsRegular>Brown fox is quick</TextMonoXsRegular>
          </TypeGalleryItem>
          <TypeGalleryItem label="Code">
            <Code>Brown fox is quick</Code>
          </TypeGalleryItem>
          <GallerySection id="buttons" title="Buttons" />
          <GalleryItem label="ButtonPrimarySolid">
            <ButtonPrimarySolid leftSection={<Plus />}>Click</ButtonPrimarySolid>
          </GalleryItem>
          <GalleryItem label="ButtonPrimaryLight">
            <ButtonPrimaryLight leftSection={<Plus />}>Click</ButtonPrimaryLight>
          </GalleryItem>
          <GalleryItem label="ButtonSecondarySolid">
            <ButtonSecondarySolid leftSection={<Plus />}>Click</ButtonSecondarySolid>
          </GalleryItem>
          <GalleryItem label="ButtonSecondaryOutline">
            <ButtonSecondaryOutline leftSection={<Plus />}>Click</ButtonSecondaryOutline>
          </GalleryItem>
          <GalleryItem label="ButtonSecondaryGhost">
            <ButtonSecondaryGhost leftSection={<Plus />}>Click</ButtonSecondaryGhost>
          </GalleryItem>
          <GalleryItem label="ButtonSecondaryInline">
            <ButtonSecondaryInline leftSection={<Plus />}>Click</ButtonSecondaryInline>
          </GalleryItem>
          <GalleryItem label="ButtonDangerLight">
            <ButtonDangerLight leftSection={<Plus />}>Click</ButtonDangerLight>
          </GalleryItem>
          <GalleryItem label="IconButtonOutline">
            <IconButtonOutline>
              <CircleCheck />
            </IconButtonOutline>
          </GalleryItem>
          <GalleryItem label="IconButtonGhost">
            <IconButtonGhost>
              <CircleCheck />
            </IconButtonGhost>
          </GalleryItem>
          <GalleryItem label="IconButtonInline">
            <IconButtonInline>
              <CircleCheck />
            </IconButtonInline>
          </GalleryItem>
          <GalleryItem label="CloseButtonInline">
            <CloseButtonInline />
          </GalleryItem>
          <GalleryItem label="DevToolButton">
            <DevToolButton>Click</DevToolButton>
          </GalleryItem>
          <GalleryItem label="ToolIconButton" notes="ActionIcon Button with tooltip. Use on toolbars and inline rows. ">
            <ToolIconButton icon={Settings} onClick={() => console.debug('clicked')} tooltip="Settings" size="sm" />
          </GalleryItem>
          {/* // TODO: Remove the deprecated ones below: */}
          <GalleryItem deprecated label="AcceptSuggestionButton">
            <AcceptSuggestionButton>Click</AcceptSuggestionButton>
          </GalleryItem>
          <GalleryItem deprecated label="RejectSuggestionButton">
            <RejectSuggestionButton>Click</RejectSuggestionButton>
          </GalleryItem>
          <GalleryItem deprecated label="ContentFooterButton">
            <ContentFooterButton>Click</ContentFooterButton>
          </GalleryItem>
          <GallerySection id="action-icons" title="Action Icons" />
          <GalleryItem label="ActionIconThreeDots">
            <ActionIconThreeDots />
          </GalleryItem>
          <GallerySection id="badges" title="Badges" />
          <GalleryItem label="Badge">
            <Badge>Neutral badge</Badge>
          </GalleryItem>
          <GalleryItem label="BadgeOK">
            <BadgeOK>Success</BadgeOK>
          </GalleryItem>
          <GalleryItem label="BadgeError">
            <BadgeError>Error</BadgeError>
          </GalleryItem>
          <GalleryItem label="Tooltip">
            <Tooltip label="No customization yet, but it's here to be searched">
              <Ambulance color="pink" />
            </Tooltip>
          </GalleryItem>
          <GallerySection id="loaders" title="Loaders" />
          <GalleryItem label="Loader">
            <Loader size="sm" />
          </GalleryItem>
          <GalleryItem label="LoaderWithMessage">
            <LoaderWithMessage message="Customize me..." />
          </GalleryItem>

          <GallerySection id="icons" title="Icons" />
          <GalleryItem label="StyledLucideIcon" notes="Adds standard mantine styling options to Lucide icons">
            <Group gap="sm">
              <StyledLucideIcon Icon={Home} size="xs" />
              <StyledLucideIcon Icon={Home} size="sm" c="gray" />
              <StyledLucideIcon Icon={Home} size="md" c="green" />
              <StyledLucideIcon Icon={Home} size="lg" c="red" />
              <StyledLucideIcon Icon={Home} size="xl" c="devTool" />
            </Group>
          </GalleryItem>
          <GalleryItem
            label="DecorativeBoxedIcon"
            notes="This isn't a Button, it's just a little box. Sometimes you want your icon in a little box? Decorative icons added to sections to provide delight."
          >
            <DecorativeBoxedIcon Icon={Home} />
          </GalleryItem>
          <GalleryItem label="AnimatedArrowsClockwise">
            <AnimatedArrowsClockwise size={32} weight="regular" />
          </GalleryItem>
          <GalleryItem label="ConnectorIcon">
            <Group gap="sm">
              {Object.values(Service).map((service) => (
                <ConnectorIcon key={service} connector={service} size={40} withBorder />
              ))}
            </Group>
          </GalleryItem>
          <GallerySection id="formatting" title="Formatting" />
          <GalleryItem label="RelativeDate (with tooltip)">
            <Text13Book c="dimmed">
              <RelativeDate date={'2025-10-05T00:25:10.892Z'} />
            </Text13Book>
          </GalleryItem>
          <GallerySection id="info-panels" title="Info Panels" />
          <GalleryItem label="Info.NotFoundIcon">
            <Info>
              <Info.NotFoundIcon />
              <Info.Title>Not Found</Info.Title>
              <Info.Description>The item you are looking for was not found.</Info.Description>
            </Info>
          </GalleryItem>
          <GalleryItem label="Info.EmptyStatus">
            <Info>
              <Info.FileIcon />
              <Info.Title>No uploads yet</Info.Title>
              <Info.Description>Drag and drop a CSV to get started</Info.Description>
            </Info>
          </GalleryItem>
          <GalleryItem label="Info.ErrorIcon">
            <Info>
              <Info.ErrorIcon />
              <Info.Title>Error Occurred</Info.Title>
              <Info.Description>Something went wrong. Please try again.</Info.Description>
            </Info>
          </GalleryItem>
          <GalleryItem label="Info.Loader">
            <Info>
              <Info.Loader />
              <Info.Title>Loading</Info.Title>
              <Info.Description>Please wait while we load your data...</Info.Description>
            </Info>
          </GalleryItem>
          <GalleryItem label="ErrorInfo (complete)">
            <ErrorInfo
              title="Failed to load data"
              error={new Error('Network connection failed')}
              retry={() => console.debug('Retry clicked')}
            />
          </GalleryItem>
          <GallerySection id="input-components" title="Input Components" />
          <GalleryItem
            label="Menu"
            notes="Use standard Mantine Menu components. Use data-delete to style a delete item."
          >
            <Menu>
              <Menu.Target>
                <ActionIconThreeDots />
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<AlignEndHorizontal size={16} />}>Item 1</Menu.Item>
                <Menu.Item leftSection={<Bird size={16} />} rightSection={<Kbd>⌘B</Kbd>}>
                  Bird
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item data-delete leftSection={<Trash2 size={16} />}>
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </GalleryItem>
          <GalleryItem label="DebouncedTextArea">
            <DebouncedTextArea
              placeholder="Type something... (debounced)"
              minRows={3}
              onChange={(e) => console.debug('Debounced value:', e.target.value)}
            />
          </GalleryItem>
          <GalleryItem label="DiffViewer">
            <DiffViewer
              originalValue="Hello, world!"
              suggestedValue="Howdy, SCRATCH ROCKS, world! more text here!"
              p="0"
            />
          </GalleryItem>
          <GalleryItem label="DiffText2">
            <DiffText2 originalValue="Hello, world!" suggestedValue="Howdy, SCRATCH ROCKS, world! more text here!" />
          </GalleryItem>
          <GallerySection id="dev-tool-components" title="Dev Tool Components" />
          <GalleryItem label="LabelValuePair">
            <LabelValuePair label="Name" value="John Doe" canCopy />
          </GalleryItem>
        </Stack>
      </MainContent.Body>
      <MainContent.Footer></MainContent.Footer>
    </MainContent>
  );
}

function GallerySection({ id, title }: { id: string; title: string }): ReactNode {
  return (
    <Stack mb={0} mt="xl">
      <TextTitle2 id={id}>{title}</TextTitle2>
      <Divider />
    </Stack>
  );
}

function GalleryItem({
  label,
  notes,
  children,
  deprecated = false,
}: {
  label: string;
  notes?: string;
  deprecated?: boolean;
  children: ReactNode;
}): ReactNode {
  return (
    <Group align="center" ml="md">
      <Stack>
        <Text16Medium w={250} style={{ textDecoration: deprecated ? 'line-through' : 'none' }}>
          {label}
        </Text16Medium>
        {notes && (
          <Text13Book c="dimmed" maw={250}>
            {notes}
          </Text13Book>
        )}
      </Stack>

      <Box flex={1} p="md">
        {children}
      </Box>
      {/* TODO: Show both light and dark mode versions of the item. */}
    </Group>
  );
}

function TypeGalleryItem({
  label,
  notes,
  children,
  deprecated = false,
}: {
  label: string;
  notes?: string;
  deprecated?: boolean;
  children: ReactNode;
}): ReactNode {
  // Renamed the ref for clarity
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [styles, setStyles] = useState<{ fontSize: string; fontWeight: string; lineHeight: string } | null>(null);

  useEffect(() => {
    // Check if the wrapper exists AND has a first element child
    if (wrapperRef.current && wrapperRef.current.firstElementChild) {
      // Get the style from the *child element* (e.g., TextSmBookDimmed's rendered element)
      const childElement = wrapperRef.current.firstElementChild;
      const computedStyle = window.getComputedStyle(childElement);

      setStyles({
        fontSize: computedStyle.fontSize,
        fontWeight: computedStyle.fontWeight,
        lineHeight: computedStyle.lineHeight,
      });
    }
  }, [children]); // This effect will re-run if the children change

  return (
    <GalleryItem label={label} notes={notes} deprecated={deprecated}>
      <Group align="baseline">
        {/* Wrap children in a div and attach the ref to it */}
        <div ref={wrapperRef}>{children}</div>

        <Code>{styles ? `fz: ${styles.fontSize} / fw: ${styles.fontWeight} / lh: ${styles.lineHeight}` : '—'}</Code>
      </Group>
    </GalleryItem>
  );
}

function GalleryColor({
  color,
  notes,
  modeAware = false,
  figmaNames,
}: {
  color: string;
  notes?: string;
  modeAware?: boolean;
  figmaNames?: string[];
}): ReactNode {
  return (
    <GalleryItem label={color} notes={notes}>
      <Group gap={0}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <ColorChip
            key={i}
            cssName={`--mantine-color-${color}-${i}`}
            modeAware={modeAware}
            figmaName={figmaNames?.[i]}
          />
        ))}
      </Group>
    </GalleryItem>
  );
}

function ColorChip({
  cssName,
  modeAware = false,
  figmaName,
}: {
  cssName: string;
  figmaName?: string;
  modeAware?: boolean;
}): ReactNode {
  const [colorValue, setColorValue] = useState('');
  const colorScheme = useComputedColorScheme();

  useEffect(() => {
    // Get the computed value of a CSS variable
    const value = getComputedStyle(document.documentElement).getPropertyValue(cssName);
    setColorValue(value.trim());
  }, [cssName, colorScheme]);

  return (
    <Stack>
      <ColorSwatch color={`var(${cssName})`} radius={0} withShadow={false} w={100} h={200}>
        {modeAware && (
          <Tooltip label="Dark-mode aware">
            <MoonStar size={16} fill="var(--mantine-color-body)" style={{ position: 'absolute', top: 3, right: 3 }} />
          </Tooltip>
        )}
        <Stack align="center" justify="flex-end" p={5}>
          <Code opacity={0.6}>{colorValue}</Code>
          <Code opacity={0.6}>{cssName}</Code>
          {figmaName && (
            <Code opacity={0.6}>
              <FigmaIcon size={12} />
              {figmaName}
            </Code>
          )}
        </Stack>
      </ColorSwatch>
    </Stack>
  );
}
