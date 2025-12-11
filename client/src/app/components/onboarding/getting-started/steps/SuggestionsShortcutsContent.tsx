import { Badge } from '@/app/components/base/badge';
import { TextMono12Regular } from '@/app/components/base/text';
import { darkOnDarkBorder, darkOnDarkMutedBg } from '@/app/components/onboarding/constants';
import { Divider, Stack } from '@mantine/core';
import { ComponentProps, FC } from 'react';
import { ShortcutRow } from '../components/ShortcutRow';
// Helper component for the shortcuts shown in the screenshot,
// can be used as 'content' for the steps.

const ShortcutBadge: FC<ComponentProps<typeof Badge>> = ({ children }) => {
  return (
    <Badge bg={darkOnDarkMutedBg} c="var(--fg-muted)">
      {children}{' '}
    </Badge>
  );
};
export const SuggestionsShortcutsContent = () => {
  return (
    <Stack gap={3}>
      <TextMono12Regular c="var(--fg-muted)">Shortcuts</TextMono12Regular>
      <Divider color={darkOnDarkBorder} />
      <ShortcutRow
        label="Accept suggestion"
        keys={
          <>
            <ShortcutBadge>⌥</ShortcutBadge>
            <ShortcutBadge>RETURN</ShortcutBadge>
          </>
        }
      />
      <Divider color={darkOnDarkBorder} />
      <ShortcutRow
        label="Reject suggestion"
        keys={
          <>
            <ShortcutBadge>⌥</ShortcutBadge>
            <ShortcutBadge ta="center">BACKSPACE</ShortcutBadge>
          </>
        }
      />
      <Divider color={darkOnDarkBorder} />
      <ShortcutRow label="Open field" keys={<ShortcutBadge>RETURN</ShortcutBadge>} />
      <Divider color={darkOnDarkBorder} />
      <ShortcutRow
        label="Open record"
        keys={
          <>
            <ShortcutBadge>⇧</ShortcutBadge>
            <ShortcutBadge>RETURN</ShortcutBadge>
          </>
        }
      />
      <Divider color={darkOnDarkBorder} />
    </Stack>
  );
};
