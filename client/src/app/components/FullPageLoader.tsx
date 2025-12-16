import { Center, Loader, Stack } from '@mantine/core';
import { JSX } from 'react';
import { Text13Book } from './base/text';

interface FullPageLoaderProps {
  size?: number | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  variant?: 'bars' | 'oval' | 'dots';
  message?: string;
}

export const FullPageLoader = (props: FullPageLoaderProps): JSX.Element => {
  return (
    <Center h="100vh" w="100vw">
      <Stack gap="xs" justify="center" align="center">
        <Loader {...props} type="bars" size={props.size ?? 'lg'} />
        {props.message && <Text13Book>{props.message}</Text13Book>}
      </Stack>
    </Center>
  );
};
