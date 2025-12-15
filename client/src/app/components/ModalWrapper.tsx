import { Box, Divider, Group, Modal, ModalProps, ScrollArea, Stack } from '@mantine/core';
import { FC } from 'react';

type Props = ModalProps & {
  customProps: {
    footer: React.ReactNode | null;
    noBodyPadding?: boolean;
  };
};

/**
 * This wrapper can be improved.
 * For now I used the 80/20 approach used since we are in pre-release mode.
 * Current features:
 * - scrollable content ares between header and footer
 * - standard footer and standard dividers
 * Possible imnprovements include default cancel button (so that the users of the component
 * do not need to pass it each time, etc)
 */

export const ModalWrapper: FC<Props> = (props) => {
  const { children, customProps, ...modalProps } = props;
  return (
    <Modal
      size="lg"
      centered
      {...modalProps}
      styles={{
        body: {
          paddingLeft: 0,
          paddingRight: 0,
        },
      }}
    >
      <Stack p={customProps.noBodyPadding ? 0 : undefined} gap={customProps.noBodyPadding ? 0 : undefined}>
        <Divider />
        <ScrollArea.Autosize mah="60vh" type="auto">
          <Box pl={customProps.noBodyPadding ? 0 : 16} pr={customProps.noBodyPadding ? 0 : 16}>
            {children}
          </Box>
        </ScrollArea.Autosize>
        {customProps.footer && (
          <>
            <Divider />
            <Group pl={16} pr={16} justify="flex-end">
              {customProps.footer}
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
};
