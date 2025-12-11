import { Text13Regular, Text9Regular, TextMono12Regular } from '@/app/components/base/text';
import { darkOnDarkBorder } from '@/app/components/onboarding/constants';
import { CopyButton, Divider, Group, Stack } from '@mantine/core';
import { CopyIcon } from 'lucide-react';

const EXAMPLES = ['Convert titles to sentence case', 'Make the titles shorter', 'Improve the summary'];

export const ChatExamplesContent = () => {
  return (
    <Stack gap={3}>
      <TextMono12Regular c="var(--fg-muted)">Examples</TextMono12Regular>
      <Divider color={darkOnDarkBorder} />
      {EXAMPLES.map((text, index) => (
        <div key={text}>
          <CopyButton value={text} timeout={1000}>
            {({ copy, copied }) => (
              <Group gap="xs" py={4} style={{ cursor: 'pointer' }} onClick={copy}>
                <CopyIcon size={14} color="var(--fg-muted)" />
                <Text13Regular c="var(--fg-primary)">{text}</Text13Regular>
                {copied && <Text9Regular c="var(--mantine-color-green-6)">Copied</Text9Regular>}
              </Group>
            )}
          </CopyButton>
          {index < EXAMPLES.length - 1 && <Divider color={darkOnDarkBorder} />}
        </div>
      ))}
      <Divider color={darkOnDarkBorder} />
    </Stack>
  );
};
