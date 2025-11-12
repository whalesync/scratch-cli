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
  List,
  Loader,
  Stack,
  Tooltip,
  useComputedColorScheme,
} from '@mantine/core';
import { Ambulance, CircleCheck, Home, MoonStar, Plus, Settings, User } from 'lucide-react';
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
  TextMdBook,
  TextMdHeavier,
  TextMdRegular,
  TextMonoSmRegular,
  TextMonoXsRegular,
  TextSmBook,
  TextSmHeavier,
  TextSmRegular,
  TextTitle1,
  TextTitle2,
  TextTitle3,
  TextTitle4,
  TextXsBook,
  TextXsHeavier,
  TextXsRegular,
} from '../../components/base/text';
import { CloseButtonInline } from '../../components/CloseButtonInline';
import { ConnectorIcon } from '../../components/ConnectorIcon';
import { DebouncedTextArea } from '../../components/DebouncedTextArea';
import { DotSpacer } from '../../components/DotSpacer';
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
          <TextSmRegular>This is a gallery of components that are available in the application</TextSmRegular>
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
          <TextXsBook c="dimmed">
            These are single-color shades that adjust for light/dark mode. Use these for all panels and text.
          </TextXsBook>
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
          <TextXsBook c="dimmed">
            These are the full 10-shade colors from Mantine. Their numbers don&apos;t exactly match the design system,
            because Mantine only supports 10 shades. Mostly use the shades above instead.
          </TextXsBook>
          <GalleryColor color="green" modeAware notes="AKA primary. Can be used in light or dark for emphasis" />
          <GalleryColor color="gray" modeAware />
          <GalleryColor color="red" modeAware />
          <GalleryColor color="blue" />
          <GalleryColor color="devTool" notes="Use for anything dev-only." />
          <GallerySection id="title-text" title="Text: title" />
          <TypeGalleryItem label="TextTitle1">
            <TextTitle1>Brown fox is quick</TextTitle1>
          </TypeGalleryItem>
          <TypeGalleryItem label="TextTitle2">
            <TextTitle2>Brown fox is quick</TextTitle2>
          </TypeGalleryItem>
          <TypeGalleryItem label="TextTitle3">
            <TextTitle3>Brown fox is quick</TextTitle3>
          </TypeGalleryItem>
          <TypeGalleryItem label="TextTitle4">
            <TextTitle4>Brown fox is quick</TextTitle4>
          </TypeGalleryItem>
          <GallerySection id="body-text" title="Text: body" />
          <TextXsBook c="dimmed">All of these support c=&apos;dimmed&apos;</TextXsBook>
          <TypeGalleryItem label="TextMdHeavier" notes="AKA text/16-medium">
            <TextMdHeavier>Brown fox is quick</TextMdHeavier>
          </TypeGalleryItem>
          <TypeGalleryItem label="TextMdRegular" notes="AKA text/16-regular">
            <TextMdRegular>Brown fox is quick</TextMdRegular>
          </TypeGalleryItem>
          <TypeGalleryItem label="TextMdBook" notes="AKA text/16-book">
            <TextMdBook>Brown fox is quick</TextMdBook>
          </TypeGalleryItem>
          <TypeGalleryItem label="TextSmHeavier" notes="AKA text/13-medium">
            <TextSmHeavier>Brown fox is quick</TextSmHeavier>
          </TypeGalleryItem>
          <TypeGalleryItem label="TextSmRegular" notes="AKA text/13-regular">
            <TextSmRegular>Brown fox is quick</TextSmRegular>
          </TypeGalleryItem>
          <TypeGalleryItem label="TextSmBook" notes="AKA text/13-book">
            <TextSmBook>Brown fox is quick</TextSmBook>
          </TypeGalleryItem>
          <TypeGalleryItem label="TextXsHeavier" notes="AKA text/12-medium">
            <TextXsHeavier>Brown fox is quick</TextXsHeavier>
          </TypeGalleryItem>
          <TypeGalleryItem label="TextXsRegular" notes="AKA text/12-regular">
            <TextXsRegular>Brown fox is quick</TextXsRegular>
          </TypeGalleryItem>
          <TypeGalleryItem label="TextXsBook" notes="AKA text/12-book">
            <TextXsBook>Brown fox is quick</TextXsBook>
          </TypeGalleryItem>
          <TypeGalleryItem label="TextXsBook c='dimmed'">
            <TextXsBook c="dimmed">Brown fox is quick</TextXsBook>
          </TypeGalleryItem>
          <GalleryItem label="DotSpacer">
            <Group gap={0}>
              <TextSmRegular>Item 1</TextSmRegular>
              <DotSpacer />
              <TextSmRegular>Item 2</TextSmRegular>
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
          <GalleryItem label="StyledLucideIcon (sm)">
            <Group gap="sm">
              <StyledLucideIcon Icon={Home} size="sm" />
              <StyledLucideIcon Icon={Settings} size="sm" />
              <StyledLucideIcon Icon={User} size="sm" />
            </Group>
          </GalleryItem>
          <GalleryItem label="StyledLucideIcon (lg)">
            <Group gap="sm">
              <StyledLucideIcon Icon={Home} size="lg" />
              <StyledLucideIcon Icon={Settings} size="lg" />
              <StyledLucideIcon Icon={User} size="lg" />
            </Group>
          </GalleryItem>
          <GalleryItem label="StyledLucideIcon (colored)">
            <Group gap="sm">
              <StyledLucideIcon Icon={Home} size="lg" c="blue.5" />
              <StyledLucideIcon Icon={Settings} size="lg" c="green.5" />
              <StyledLucideIcon Icon={User} size="lg" c="red.5" />
            </Group>
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
            <TextSmBook c="dimmed">
              <RelativeDate date={'2025-10-05T00:25:10.892Z'} />
            </TextSmBook>
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
        <TextMdHeavier w={250} style={{ textDecoration: deprecated ? 'line-through' : 'none' }}>
          {label}
        </TextMdHeavier>
        {notes && (
          <TextSmBook c="dimmed" maw={250}>
            {notes}
          </TextSmBook>
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
}: {
  color: string;
  notes?: string;
  modeAware?: boolean;
}): ReactNode {
  return (
    <GalleryItem label={color} notes={notes}>
      <Group gap={0}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <ColorChip key={i} cssName={`--mantine-color-${color}-${i}`} modeAware={modeAware} />
        ))}
      </Group>
    </GalleryItem>
  );
}

function ColorChip({ cssName, modeAware = false }: { cssName: string; modeAware?: boolean }): ReactNode {
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
          <Code opacity={0.6}>{cssName}</Code>
          <Code opacity={0.6}>{colorValue}</Code>
        </Stack>
      </ColorSwatch>
    </Stack>
  );
}
