interface WebSocketMessage {
  type: string;
  data?: {
    message?: string;
    response_message?: string;
    detail?: string;
    usage_stats?: {
      requests: number;
      request_tokens: number;
      response_tokens: number;
      total_tokens: number;
    };
  };
  timestamp?: string;
}

export async function waitForWebSocketMessage(
  ws: WebSocket,
  messageType: string,
  timeoutMs: number,
): Promise<WebSocketMessage> {
  return new Promise<WebSocketMessage>((resolve, reject) => {
    const timeoutRef = setTimeout(() => {
      return handleError(`Timed out before expected message was received after ${timeoutMs} ms`);
    }, timeoutMs);

    const cleanup = () => {
      ws.removeEventListener('message', onMessage);
      ws.removeEventListener('error', onError);
      ws.removeEventListener('close', onClose);
      clearTimeout(timeoutRef);
    };

    const handleError = (error: Error | string) => {
      cleanup();
      reject(error instanceof Error ? error : new Error(error));
    };

    const onMessage = (event: MessageEvent) => {
      try {
        if (typeof event.data !== 'string') {
          return handleError(`Type error: expected WebSocket event.data to be a string, got ${typeof event.data}`);
        }

        const message = JSON.parse(event.data) as WebSocketMessage;
        console.log(`Received message (${typeof event.data}):`, JSON.stringify(message, null, 2));

        if (message.type.includes('error')) {
          console.error(`Received error type message from agent websocket: ${message.type}`);
          return handleError(message.data?.detail ?? message.type);
        }

        // Log and continue if wrong message type
        if (message.type !== messageType) {
          return;
        }

        cleanup();
        return resolve(message);
      } catch (error) {
        return handleError(error instanceof Error ? error : new Error(String(error)));
      }
    };

    const onError = (evt: Event) => {
      return handleError(`WebSocket error occurred: ${evt.type}`);
    };

    const onClose = () => {
      return handleError('WebSocket closed before expected message was received');
    };

    ws.addEventListener('message', onMessage);
    ws.addEventListener('error', onError);
    ws.addEventListener('close', onClose);
  });
}
