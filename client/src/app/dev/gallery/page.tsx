'use client';

import MainContent from '@/app/components/layouts/MainContent';
import { Anchor, Box, Divider, Group, List, Loader, Stack } from '@mantine/core';
import { Home, Plus, Settings, User } from 'lucide-react';
import { ReactNode } from 'react';
import { Service } from '../../../types/server-entities/connector-accounts';
import { AnimatedArrowsClockwise } from '../../components/AnimatedArrowsClockwise';
import { BadgeWithTooltip } from '../../components/BadgeWithTooltip';
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
  TextBookMd,
  TextBookSm,
  TextBookSmLight,
  TextBookXs,
  TextHeavierMd,
  TextHeavierSm,
  TextHeavierXs,
  TextRegularMd,
  TextRegularSm,
  TextRegularXs,
  TextTitle1,
  TextTitle2,
  TextTitle3,
  TextTitle4,
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
          <TextRegularSm>This is a gallery of components that are available in the application</TextRegularSm>
          {/* Table of contents */}
          <List>
            <Anchor href="#title-text">
              <List.Item>Title Text</List.Item>
            </Anchor>
            <Anchor href="#body-text">
              <List.Item>Body Text</List.Item>
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

          <GallerySection id="title-text" title="Title Text" />
          <GalleryItem label="TextTitle1" item={<TextTitle1>Brown fox is quick</TextTitle1>} />
          <GalleryItem label="TextTitle2" item={<TextTitle2>Brown fox is quick</TextTitle2>} />
          <GalleryItem label="TextTitle3" item={<TextTitle3>Brown fox is quick</TextTitle3>} />
          <GalleryItem label="TextTitle4" item={<TextTitle4>Brown fox is quick</TextTitle4>} />

          <GallerySection id="body-text" title="Body Text" />
          <GalleryItem label="TextHeavierMd" item={<TextHeavierMd>Brown fox is quick</TextHeavierMd>} />
          <GalleryItem label="TextHeavierSm" item={<TextHeavierSm>Brown fox is quick</TextHeavierSm>} />
          <GalleryItem label="TextHeavierXs" item={<TextHeavierXs>Brown fox is quick</TextHeavierXs>} />
          <GalleryItem label="TextRegularMd" item={<TextRegularMd>Brown fox is quick</TextRegularMd>} />
          <GalleryItem label="TextRegularSm" item={<TextRegularSm>Brown fox is quick</TextRegularSm>} />
          <GalleryItem label="TextRegularXs" item={<TextRegularXs>Brown fox is quick</TextRegularXs>} />
          <GalleryItem label="TextBookMd" item={<TextBookMd>Brown fox is quick</TextBookMd>} />
          <GalleryItem label="TextBookSm" item={<TextBookSm>Brown fox is quick</TextBookSm>} />
          <GalleryItem label="TextBookSmLight" item={<TextBookSmLight>Brown fox is quick</TextBookSmLight>} />
          <GalleryItem label="TextBookXs" item={<TextBookXs>Brown fox is quick</TextBookXs>} />

          <GalleryItem
            label="DotSpacer"
            item={
              <Group gap={0}>
                <TextRegularSm>Item 1</TextRegularSm>
                <DotSpacer />
                <TextRegularSm>Item 2</TextRegularSm>
              </Group>
            }
          />

          <GallerySection id="buttons" title="Buttons" />
          <GalleryItem
            label="ButtonPrimarySolid"
            item={<ButtonPrimarySolid leftSection={<Plus />}>Click</ButtonPrimarySolid>}
          />
          <GalleryItem
            label="ButtonPrimaryLight"
            item={<ButtonPrimaryLight leftSection={<Plus />}>Click</ButtonPrimaryLight>}
          />
          <GalleryItem
            label="ButtonSecondarySolid"
            item={<ButtonSecondarySolid leftSection={<Plus />}>Click</ButtonSecondarySolid>}
          />
          <GalleryItem
            label="ButtonSecondaryOutline"
            item={<ButtonSecondaryOutline leftSection={<Plus />}>Click</ButtonSecondaryOutline>}
          />
          <GalleryItem
            label="ButtonSecondaryGhost"
            item={<ButtonSecondaryGhost leftSection={<Plus />}>Click</ButtonSecondaryGhost>}
          />
          <GalleryItem
            label="ButtonSecondaryInline"
            item={<ButtonSecondaryInline leftSection={<Plus />}>Click</ButtonSecondaryInline>}
          />
          <GalleryItem
            label="ButtonDangerLight"
            item={<ButtonDangerLight leftSection={<Plus />}>Click</ButtonDangerLight>}
          />
          <GalleryItem label="DevToolButton" item={<DevToolButton>Click</DevToolButton>} />
          {/* // TODO: Remove the deprecated ones below: */}
          <GalleryItem
            deprecated
            label="AcceptSuggestionButton"
            item={<AcceptSuggestionButton>Click</AcceptSuggestionButton>}
          />
          <GalleryItem
            deprecated
            label="RejectSuggestionButton"
            item={<RejectSuggestionButton>Click</RejectSuggestionButton>}
          />
          <GalleryItem deprecated label="ContentFooterButton" item={<ContentFooterButton>Click</ContentFooterButton>} />
          <GalleryItem
            deprecated
            label="ToolIconButton"
            item={<ToolIconButton icon={Settings} onClick={() => console.debug('clicked')} tooltip="Settings" />}
          />

          <GallerySection id="badges" title="Badges" />
          <GalleryItem
            label="BadgeWithTooltip"
            item={<BadgeWithTooltip tooltip="This is a helpful tooltip">Hover me</BadgeWithTooltip>}
          />

          <GallerySection id="loaders" title="Loaders" />
          <GalleryItem label="Loader (Mantine sm)" item={<Loader size="sm" />} />
          <GalleryItem label="Loader (Mantine md)" item={<Loader size="md" />} />
          <GalleryItem label="Loader (Mantine lg)" item={<Loader size="lg" />} />
          <GalleryItem label="LoaderWithMessage" item={<LoaderWithMessage message="Processing..." />} />
          <GalleryItem label="LoaderWithMessage (default)" item={<LoaderWithMessage />} />

          <GallerySection id="icons" title="Icons" />
          <GalleryItem
            label="StyledLucideIcon (sm)"
            item={
              <Group gap="sm">
                <StyledLucideIcon Icon={Home} size="sm" />
                <StyledLucideIcon Icon={Settings} size="sm" />
                <StyledLucideIcon Icon={User} size="sm" />
              </Group>
            }
          />
          <GalleryItem
            label="StyledLucideIcon (md)"
            item={
              <Group gap="sm">
                <StyledLucideIcon Icon={Home} size="md" />
                <StyledLucideIcon Icon={Settings} size="md" />
                <StyledLucideIcon Icon={User} size="md" />
              </Group>
            }
          />
          <GalleryItem
            label="StyledLucideIcon (lg)"
            item={
              <Group gap="sm">
                <StyledLucideIcon Icon={Home} size="lg" />
                <StyledLucideIcon Icon={Settings} size="lg" />
                <StyledLucideIcon Icon={User} size="lg" />
              </Group>
            }
          />
          <GalleryItem
            label="StyledLucideIcon (colored)"
            item={
              <Group gap="sm">
                <StyledLucideIcon Icon={Home} size="lg" c="blue.5" />
                <StyledLucideIcon Icon={Settings} size="lg" c="green.5" />
                <StyledLucideIcon Icon={User} size="lg" c="red.5" />
              </Group>
            }
          />
          <GalleryItem label="AnimatedArrowsClockwise" item={<AnimatedArrowsClockwise size={32} weight="regular" />} />
          <GalleryItem label="ConnectorIcon" item={<ConnectorIcon connector={Service.YOUTUBE} size={40} />} />

          <GallerySection id="info-panels" title="Info Panels" />
          <GalleryItem
            label="Info.NotFoundIcon"
            item={
              <Info>
                <Info.NotFoundIcon />
                <Info.Title>Not Found</Info.Title>
                <Info.Description>The item you are looking for was not found.</Info.Description>
              </Info>
            }
          />
          <GalleryItem
            label="Info.ErrorIcon"
            item={
              <Info>
                <Info.ErrorIcon />
                <Info.Title>Error Occurred</Info.Title>
                <Info.Description>Something went wrong. Please try again.</Info.Description>
              </Info>
            }
          />
          <GalleryItem
            label="Info.Loader"
            item={
              <Info>
                <Info.Loader />
                <Info.Title>Loading</Info.Title>
                <Info.Description>Please wait while we load your data...</Info.Description>
              </Info>
            }
          />
          <GalleryItem
            label="ErrorInfo (complete)"
            item={
              <ErrorInfo
                title="Failed to load data"
                error={new Error('Network connection failed')}
                retry={() => console.debug('Retry clicked')}
              />
            }
          />

          <GallerySection id="input-components" title="Input Components" />
          <GalleryItem
            label="DebouncedTextArea"
            item={
              <DebouncedTextArea
                placeholder="Type something... (debounced)"
                minRows={3}
                onChange={(e) => console.debug('Debounced value:', e.target.value)}
              />
            }
          />
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
  item,
  deprecated = false,
}: {
  label: string;
  item: ReactNode;
  deprecated?: boolean;
}): ReactNode {
  return (
    <Group align="center" ml="md">
      <TextHeavierMd w={250} style={{ textDecoration: deprecated ? 'line-through' : 'none' }}>
        {label}
      </TextHeavierMd>
      <Box flex={1} p="md">
        {item}
      </Box>
      {/* TODO: Show both light and dark mode versions of the item. */}
    </Group>
  );
}
