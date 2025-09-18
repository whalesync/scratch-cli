import { Flex, Group, Loader, Text } from '@mantine/core';
import { JSX } from 'react';

interface FullPageLoaderProps {
  size?: number | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  variant?: 'bars' | 'oval' | 'dots';
  message?: string;
}

export const FullPageLoader = (props: FullPageLoaderProps): JSX.Element => {
  return (
    <Flex justify="center" align="center" h="100vh" w="100vw">
      <Group gap="xs">
        <Loader {...props} size={props.size ?? 'lg'} />
        {props.message && <Text>{props.message}</Text>}
      </Group>
    </Flex>
  );
};
