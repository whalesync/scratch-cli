import { Center, Group, Loader } from '@mantine/core';
import { TextRegularSm } from './base/text';

export const LoaderWithMessage = ({ message }: { message?: string }) => {
  return (
    <Center flex={1} h="100%" w="100%">
      <Group gap="xs" align="center">
        <Loader />
        <TextRegularSm>{message ?? 'Loading...'}</TextRegularSm>
      </Group>
    </Center>
  );
};
