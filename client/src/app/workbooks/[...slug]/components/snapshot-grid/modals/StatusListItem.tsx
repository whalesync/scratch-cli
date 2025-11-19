import { Text12Regular, Text13Regular } from '@/app/components/base/text';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { Box, Group, Stack } from '@mantine/core';
import { ComponentProps, FC } from 'react';

type Props = {
  text1: string;
  text2?: string;
  iconProps: ComponentProps<typeof StyledLucideIcon>;
};
export const StatusListItem: FC<Props> = ({ text1, text2, iconProps }) => {
  return (
    <Box p="xs" bg="var(--bg-panel)" style={{ border: '1px solid var(--mantine-color-gray-3)' }}>
      <Group align="flex-start" gap="sm">
        {/* 
        mt=1 since when the icon is truly alligned with the text it looks bad/unalligned to a human 
        since lower case text has its center of mass low.
        */}
        <StyledLucideIcon {...iconProps} mt={1} />
        <Stack gap="2xs">
          <Text13Regular>{text1}</Text13Regular>
          {text2 && <Text12Regular c="dimmed">{text2}</Text12Regular>}
        </Stack>
      </Group>
    </Box>
  );
};
