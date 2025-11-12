/**
 * WebSocket close codes as defined in RFC 6455
 * These constants represent common reasons for WebSocket disconnections
 */
export const WebSocketCloseCode = {
  /** Normal closure - the connection completed its purpose */
  NORMAL_CLOSURE: 1000,
  /** Going away - the endpoint is going away (e.g., server shutdown, browser navigation) */
  GOING_AWAY: 1001,
  /** Protocol error - the endpoint terminated the connection due to a protocol error */
  PROTOCOL_ERROR: 1002,
  /** Unsupported data - the endpoint received data of a type it cannot accept */
  UNSUPPORTED_DATA: 1003,
  /** Reserved - no status code was provided */
  NO_STATUS_RECEIVED: 1005,
  /** Abnormal closure - connection closed without a close frame (reserved, used when connection is closed without a close frame) */
  ABNORMAL_CLOSURE: 1006,
  /** Invalid frame payload data - the endpoint received invalid UTF-8 data */
  INVALID_FRAME_PAYLOAD_DATA: 1007,
  /** Policy violation - the endpoint terminated the connection because it received a message that violates its policy */
  POLICY_VIOLATION: 1008,
  /** Message too big - the endpoint terminated the connection because it received a message that is too big */
  MESSAGE_TOO_BIG: 1009,
  /** Mandatory extension - the client terminated the connection because the server did not negotiate a required extension */
  MANDATORY_EXTENSION: 1010,
  /** Internal server error - the server terminated the connection because it encountered an unexpected condition */
  INTERNAL_SERVER_ERROR: 1011,
  /** Service restart - the server terminated the connection because it is restarting */
  SERVICE_RESTART: 1012,
  /** Try again later - the server terminated the connection due to a temporary condition */
  TRY_AGAIN_LATER: 1013,
  /** Bad gateway - the server acting as a gateway received an invalid response */
  BAD_GATEWAY: 1014,
  /** TLS handshake - connection closed due to TLS handshake failure (reserved) */
  TLS_HANDSHAKE: 1015,
} as const;

export type WebSocketCloseCode = (typeof WebSocketCloseCode)[keyof typeof WebSocketCloseCode];
