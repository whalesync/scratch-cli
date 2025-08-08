import { Text, TextProps } from '@mantine/core';
import { JSX } from 'react';

export const DotSpacer = (props: TextProps): JSX.Element => {
  return (
    <Text fw={500} component="span" c="gray.10" mx="xs" {...props}>
      &#183;
    </Text>
  );
};
