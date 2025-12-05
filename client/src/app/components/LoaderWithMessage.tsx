import { Center, Group, Loader, MantineSize } from '@mantine/core';
import { Text13Regular } from './base/text';

export const LoaderWithMessage = ({
  message,
  centered = false,
  size = 'md',
}: {
  message?: string;
  centered?: boolean;
  size?: MantineSize | (string & {}) | number;
}) => {
  const content = (
    <Group gap="xs" align="center">
      <Loader size={size} />
      <Text13Regular>{message ?? 'Loading...'}</Text13Regular>
    </Group>
  );
  if (centered) {
    return (
      <Center flex={1} h="100%" w="100%">
        {content}
      </Center>
    );
  }
  return content;
};
