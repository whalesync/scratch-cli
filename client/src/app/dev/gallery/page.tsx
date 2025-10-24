'use client';

import MainContent from '@/app/components/layouts/MainContent';
import { Center, Divider, Group, Loader, Stack } from '@mantine/core';
import { Home, Settings, User } from 'lucide-react';
import { ReactNode } from 'react';
import { Service } from '../../../types/server-entities/connector-accounts';
import { AnimatedArrowsClockwise } from '../../components/AnimatedArrowsClockwise';
import { BadgeWithTooltip } from '../../components/BadgeWithTooltip';
import {
  AcceptSuggestionButton,
  ContentFooterButton,
  DevToolButton,
  InlineButton,
  PrimaryButton,
  RejectSuggestionButton,
  SecondaryButton,
} from '../../components/base/buttons';
import {
  TextBookSm,
  TextBookXs,
  TextRegularSm,
  TextRegularXs,
  TextTitle2XL,
  TextTitleLg,
  TextTitleSm,
  TextTitleXs,
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

          <GallerySection title="Text" />
          <GalleryItem label="TextTitle2XL" item={<TextTitle2XL>Brown fox is quick</TextTitle2XL>} />
          <GalleryItem label="TextTitleLg" item={<TextTitleLg>Brown fox is quick</TextTitleLg>} />
          <GalleryItem label="TextTitleSm" item={<TextTitleSm>Brown fox is quick</TextTitleSm>} />
          <GalleryItem label="TextTitleXs" item={<TextTitleXs>Brown fox is quick</TextTitleXs>} />
          <GalleryItem label="TextRegularSm" item={<TextRegularSm>Brown fox is quick</TextRegularSm>} />
          <GalleryItem label="TextRegularXs" item={<TextRegularXs>Brown fox is quick</TextRegularXs>} />
          <GalleryItem label="TextBookSm" item={<TextBookSm>Brown fox is quick</TextBookSm>} />
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

          <GallerySection title="Buttons" />
          <GalleryItem label="InlineButton" item={<InlineButton>Click</InlineButton>} />
          <GalleryItem label="PrimaryButton" item={<PrimaryButton>Click</PrimaryButton>} />
          <GalleryItem label="SecondaryButton" item={<SecondaryButton>Click</SecondaryButton>} />
          <GalleryItem label="AcceptSuggestionButton" item={<AcceptSuggestionButton>Click</AcceptSuggestionButton>} />
          <GalleryItem label="RejectSuggestionButton" item={<RejectSuggestionButton>Click</RejectSuggestionButton>} />
          <GalleryItem label="DevToolButton" item={<DevToolButton>Click</DevToolButton>} />
          <GalleryItem label="ContentFooterButton" item={<ContentFooterButton>Click</ContentFooterButton>} />
          <GalleryItem
            label="ToolIconButton"
            item={<ToolIconButton icon={Settings} onClick={() => console.debug('clicked')} tooltip="Settings" />}
          />

          <GallerySection title="Badges" />
          <GalleryItem
            label="BadgeWithTooltip"
            item={<BadgeWithTooltip tooltip="This is a helpful tooltip">Hover me</BadgeWithTooltip>}
          />

          <GallerySection title="Loaders" />
          <GalleryItem label="Loader (Mantine sm)" item={<Loader size="sm" />} />
          <GalleryItem label="Loader (Mantine md)" item={<Loader size="md" />} />
          <GalleryItem label="Loader (Mantine lg)" item={<Loader size="lg" />} />
          <GalleryItem label="LoaderWithMessage" item={<LoaderWithMessage message="Processing..." />} />
          <GalleryItem label="LoaderWithMessage (default)" item={<LoaderWithMessage />} />

          <GallerySection title="Icons" />
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

          <GallerySection title="Info Panels" />
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

          <GallerySection title="Input Components" />
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

function GallerySection({ title }: { title: string }): ReactNode {
  return (
    <Stack mb={0} mt="xl">
      <TextTitleLg>{title}</TextTitleLg>
      <Divider />
    </Stack>
  );
}

function GalleryItem({ label, item }: { label: string; item: ReactNode }): ReactNode {
  return (
    <Group align="center" ml="md">
      <TextTitleSm w={250}>{label}</TextTitleSm>
      <Center flex={1} p="md">
        {item}
      </Center>
      {/* TODO: Show both light and dark mode versions of the item. */}
    </Group>
  );
}
