import { Text12Book, TextMono12Regular, TextTitle4 } from '@/app/components/base/text';
import { useWorkbookWebSocketMessageLog } from '@/stores/workbook-websocket-store';
import { timeAgo } from '@/utils/helpers';
import { Dialog, DialogProps, Divider, ScrollArea, Stack } from '@mantine/core';
import { Fragment } from 'react';

export const WorkbookWebsocketEventDebugDialog = (props: DialogProps) => {
  const messageLog = useWorkbookWebSocketMessageLog();

  return (
    <Dialog
      {...props}
      title="Workbook Websocket Event Log"
      withBorder
      shadow="sm"
      radius="sm"
      position={{ bottom: 50, left: 20 }}
    >
      <TextTitle4>Workbook Websocket Event Log</TextTitle4>
      <ScrollArea h={600}>
        <Stack gap="4px">
          {messageLog.map((item, index) => {
            let message = <TextMono12Regular>{item.message}</TextMono12Regular>;

            if (item.message.startsWith('{')) {
              try {
                message = (
                  <div style={{ fontSize: '10px', fontFamily: 'monospace' }}>
                    <pre>{JSON.stringify(JSON.parse(item.message), null, 2)}</pre>
                  </div>
                );
              } catch (error) {
                console.error('Error parsing JSON:', error);
              }
            }

            return (
              <Fragment key={index}>
                {index > 0 && <Divider />}
                <Stack gap="2px" w="100%">
                  {message}
                  <Text12Book fz="0.7rem" c="dimmed">
                    {timeAgo(item.timestamp)}
                  </Text12Book>
                </Stack>
              </Fragment>
            );
          })}
        </Stack>
      </ScrollArea>
    </Dialog>
  );
};
