import { Box, Group } from '@mantine/core';
import { FC, JSX } from 'react';
type Props = {
  icon: JSX.Element;
  text: JSX.Element;
};
export const IconAndTextGroup: FC<Props> = (props) => {
  const { icon, text } = props;

  return (
    <Group gap={4} style={{ minHeight: 30 }}>
      <Box
        style={{
          minWidth: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </Box>
      {text}
    </Group>
  );
};
