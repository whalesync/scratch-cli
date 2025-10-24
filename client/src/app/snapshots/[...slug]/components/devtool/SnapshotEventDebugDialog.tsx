import { TextTitleXs } from '@/app/components/base/text';
import { timeAgo } from '@/utils/helpers';
import { Dialog, DialogProps, ScrollArea, Stack, Text } from '@mantine/core';
import { useSnapshotEventContext } from '../contexts/snapshot-event-context';

export const SnapshotEventDebugDialog = (props: DialogProps) => {
  const { messageLog } = useSnapshotEventContext();
  return (
    <Dialog
      {...props}
      title="Snapshot Event Log"
      withBorder
      shadow="sm"
      radius="sm"
      position={{ bottom: 20, left: 20 }}
    >
      <ScrollArea h={500}>
        <Stack gap="xs">
          <TextTitleXs>Snapshot Event Log</TextTitleXs>
          {messageLog.map((item, index) => (
            <Stack key={index} gap="2px" w="100%">
              <Text size="xs">{item.message}</Text>
              <Text size="0.7rem" c="dimmed">
                {timeAgo(item.timestamp)}
              </Text>
            </Stack>
          ))}
        </Stack>
      </ScrollArea>
    </Dialog>
  );
};
