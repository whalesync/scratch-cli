'use client';

import MainContent from '@/app/components/layouts/MainContent';
import { Anchor, Box, Code, Divider, Group, List, Loader, Stack, Tooltip } from '@mantine/core';
import { Ambulance, Home, Plus, Settings, User } from 'lucide-react';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Service } from '../../../types/server-entities/connector-accounts';
import { AnimatedArrowsClockwise } from '../../components/AnimatedArrowsClockwise';
import { BadgeBase, BadgeError, BadgeOK } from '../../components/base/badges';
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
import { ConnectorIcon } from '../../components/ConnectorIcon';
import { DebouncedTextArea } from '../../components/DebouncedTextArea';
import { DotSpacer } from '../../components/DotSpacer';
import { StyledLucideIcon } from '../../components/Icons/StyledLucideIcon';
import { ErrorInfo, Info } from '../../components/InfoPanel';
import { LoaderWithMessage } from '../../components/LoaderWithMessage';
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
            <Anchor href="#title-text">
              <List.Item>Text: title</List.Item>
            </Anchor>
            <Anchor href="#body-text">
              <List.Item>Text: body</List.Item>
            </Anchor>
            <Anchor href="#mono-text">
              <List.Item>Text: monospace</List.Item>
            </Anchor>
            <Anchor href="#buttons">
              <List.Item>Buttons</List.Item>
            </Anchor>
            <Anchor href="#badges">
              <List.Item>Badges</List.Item>
            </Anchor>
            <Anchor href="#loaders">
              <List.Item>Loaders</List.Item>
            </Anchor>
            <Anchor href="#icons">
              <List.Item>Icons</List.Item>
            </Anchor>
            <Anchor href="#info-panels">
              <List.Item>Info Panels</List.Item>
            </Anchor>
            <Anchor href="#input-components">
              <List.Item>Input Components</List.Item>
            </Anchor>
          </List>

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
          <TextXsBook variant="dimmed">All of these support variant=&apos;dimmed&apos;</TextXsBook>
          <TypeGalleryItem label="TextMdHeavier">
            <TextMdHeavier>Brown fox is quick</TextMdHeavier>
          </TypeGalleryItem>
          <TypeGalleryItem label="TextMdRegular">
            <TextMdRegular>Brown fox is quick</TextMdRegular>
          </TypeGalleryItem>
          <TypeGalleryItem label="TextMdBook">
            <TextMdBook>Brown fox is quick</TextMdBook>
          </TypeGalleryItem>
          <TypeGalleryItem label="TextSmHeavier">
            <TextSmHeavier>Brown fox is quick</TextSmHeavier>
          </TypeGalleryItem>
          <TypeGalleryItem label="TextSmRegular">
            <TextSmRegular>Brown fox is quick</TextSmRegular>
          </TypeGalleryItem>
          <TypeGalleryItem label="TextSmBook">
            <TextSmBook>Brown fox is quick</TextSmBook>
          </TypeGalleryItem>
          <TypeGalleryItem label="TextXsHeavier">
            <TextXsHeavier>Brown fox is quick</TextXsHeavier>
          </TypeGalleryItem>
          <TypeGalleryItem label="TextXsRegular">
            <TextXsRegular>Brown fox is quick</TextXsRegular>
          </TypeGalleryItem>
          <TypeGalleryItem label="TextXsBook">
            <TextXsBook>Brown fox is quick</TextXsBook>
          </TypeGalleryItem>
          <TypeGalleryItem label="variant='dimmed'">
            <TextMdRegular variant="dimmed">Brown fox is quick</TextMdRegular>
          </TypeGalleryItem>

          <GalleryItem label="DotSpacer">
            <Group gap={0}>
              <TextSmRegular>Item 1</TextSmRegular>
              <DotSpacer />
              <TextSmRegular>Item 2</TextSmRegular>
            </Group>
          </GalleryItem>

          <GallerySection id="mono-text" title="Text: monospace" />
          <TypeGalleryItem label="TextMonoRegularSm">
            <TextMonoSmRegular>Brown fox is quick</TextMonoSmRegular>
          </TypeGalleryItem>
          <TypeGalleryItem label="TextMonoRegularXs">
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
          <GalleryItem label="DevToolButton">
            <DevToolButton>Click</DevToolButton>
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
          <GalleryItem deprecated label="ToolIconButton">
            <ToolIconButton icon={Settings} onClick={() => console.debug('clicked')} tooltip="Settings" />
          </GalleryItem>

          <GallerySection id="badges" title="Badges" />
          <GalleryItem label="BadgeBase">
            <BadgeBase>Neutral badge</BadgeBase>
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
            <ConnectorIcon connector={Service.YOUTUBE} size={40} />
          </GalleryItem>

          <GallerySection id="info-panels" title="Info Panels" />
          <GalleryItem label="Info.NotFoundIcon">
            <Info>
              <Info.NotFoundIcon />
              <Info.Title>Not Found</Info.Title>
              <Info.Description>The item you are looking for was not found.</Info.Description>
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
  children,
  deprecated = false,
}: {
  label: string;
  deprecated?: boolean;
  children: ReactNode;
}): ReactNode {
  return (
    <Group align="center" ml="md">
      <TextMdHeavier w={250} style={{ textDecoration: deprecated ? 'line-through' : 'none' }}>
        {label}
      </TextMdHeavier>
      <Box flex={1} p="md">
        {children}
      </Box>
      {/* TODO: Show both light and dark mode versions of the item. */}
    </Group>
  );
}

function TypeGalleryItem({
  label,
  children,
  deprecated = false,
}: {
  label: string;
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
    <GalleryItem label={label} deprecated={deprecated}>
      <Group align="baseline">
        {/* Wrap children in a div and attach the ref to it */}
        <div ref={wrapperRef}>{children}</div>

        <Code>{styles ? `fz: ${styles.fontSize} / fw: ${styles.fontWeight} / lh: ${styles.lineHeight}` : '—'}</Code>
      </Group>
    </GalleryItem>
  );
}
