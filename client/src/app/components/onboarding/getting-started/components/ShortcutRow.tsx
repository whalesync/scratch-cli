import { Text13Regular } from '@/app/components/base/text';
import { Group } from '@mantine/core';
import { ReactNode } from 'react';
export const ShortcutRow = ({ label, keys }: { label: string; keys: ReactNode }) => (
  <Group justify="space-between" align="center" py={4}>
    <Text13Regular size="xs">{label}</Text13Regular>
    <Group gap={4}>{keys}</Group>
  </Group>
);
