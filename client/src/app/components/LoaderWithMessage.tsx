import { Center, Group, Loader } from '@mantine/core';
import { TextSmRegular } from './base/text';

export const LoaderWithMessage = ({ message, centered = false }: { message?: string; centered?: boolean }) => {
  const content = (
    <Group gap="xs" align="center">
      <Loader />
      <TextSmRegular>{message ?? 'Loading...'}</TextSmRegular>
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
