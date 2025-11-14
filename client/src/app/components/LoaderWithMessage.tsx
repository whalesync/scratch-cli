import { Center, Group, Loader } from '@mantine/core';
import { Text13Regular } from './base/text';

export const LoaderWithMessage = ({ message, centered = false }: { message?: string; centered?: boolean }) => {
  const content = (
    <Group gap="xs" align="center">
      <Loader />
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
