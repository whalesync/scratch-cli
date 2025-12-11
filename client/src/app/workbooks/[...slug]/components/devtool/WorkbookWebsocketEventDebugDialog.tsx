import { Text12Book, TextMono12Regular, TextTitle4 } from '@/app/components/base/text';
import { useWorkbookWebSocketMessageLog } from '@/stores/workbook-websocket-store';
import { timeAgo } from '@/utils/helpers';
import { Dialog, DialogProps, ScrollArea, Stack } from '@mantine/core';

export const WorkbookWebsocketEventDebugDialog = (props: DialogProps) => {
  const messageLog = useWorkbookWebSocketMessageLog();
  return (
    <Dialog
      {...props}
      title="Workbook Websocket Event Log"
      withBorder
      shadow="sm"
      radius="sm"
      position={{ bottom: 20, left: 20 }}
    >
      <ScrollArea h={500}>
        <Stack gap="xs">
          <TextTitle4>Workbook Websocket Event Log</TextTitle4>
          {messageLog.map((item, index) => {
            let message = <TextMono12Regular>{item.message}</TextMono12Regular>;

            if (item.message.startsWith('{')) {
              try {
                message = (
                  <div style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                    <pre>{JSON.stringify(JSON.parse(item.message), null, 2)}</pre>
                  </div>
                );
              } catch (error) {
                console.error('Error parsing JSON:', error);
              }
            }

            return (
              <Stack key={index} gap="2px" w="100%">
                <Text12Book fz="0.7rem" c="dimmed">
                  {message}
                  {timeAgo(item.timestamp)}
                </Text12Book>
              </Stack>
            );
          })}
        </Stack>
      </ScrollArea>
    </Dialog>
  );
};
