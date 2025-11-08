import { nanoid } from 'nanoid';

/**
 * Generates a randomized 32 character API token string
 * @returns new token string
 */
export function generateApiToken(): string {
  // Generate a secure 32-character token using nanoid
  return nanoid(32);
}

/**
 * @returns The expiration date for a standard API token
 */
export function generateTokenExpirationDate(): Date {
  // set to 6 months from now
  return new Date(Date.now() + 1000 * 60 * 60 * 24 * 180); // 6 months
}

/**
 * @returns The expiration date for a websocket token
 */
export function generateWebsocketTokenExpirationDate(): Date {
  // set to 1 day from now
  return new Date(Date.now() + 1000 * 60 * 60 * 24);
}
