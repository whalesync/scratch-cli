import { Box, Divider, Group, Modal, ModalProps, ScrollArea, Stack } from '@mantine/core';
import { FC } from 'react';

type Props = ModalProps & {
  customProps: {
    footer: React.ReactNode;
  };
};

export const ModalWrapper: FC<Props> = (props) => {
  const { children, customProps, ...modalProps } = props;
  console.log(customProps);
  return (
    <Modal
      {...modalProps}
      styles={{
        body: {
          paddingLeft: 0,
          paddingRight: 0,
        },
      }}
    >
      <Stack>
        <Divider />
        <ScrollArea.Autosize mah="60vh" type="auto">
          <Box pl={16} pr={16}>
            {children}
          </Box>
        </ScrollArea.Autosize>
        <Divider />
        <Group pl={16} pr={16} justify="flex-end">
          {customProps.footer}
        </Group>
      </Stack>
    </Modal>
  );
};
