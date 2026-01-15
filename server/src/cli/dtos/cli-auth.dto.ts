import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Response when initiating CLI authorization flow.
 * CLI receives this and displays the userCode while polling with pollingCode.
 */
export class AuthInitiateResponseDto {
  /** The short code to display to the user (e.g., "ABCD-1234") */
  readonly userCode?: string;

  /** The polling code for CLI to poll with */
  readonly pollingCode?: string;

  /** URL where user should go to authorize */
  readonly verificationUrl?: string;

  /** How long the code is valid (seconds) */
  readonly expiresIn?: number;

  /** Recommended polling interval (seconds) */
  readonly interval?: number;

  /** Error message if initiation failed */
  readonly error?: string;
}

/**
 * Request to poll for authorization status.
 */
export class AuthPollRequestDto {
  @IsString()
  @IsNotEmpty()
  pollingCode?: string;
}

/**
 * Response when polling for authorization status.
 */
export class AuthPollResponseDto {
  /** Authorization status: "pending", "approved", "denied", "expired" */
  readonly status?: string;

  /** The API token (only set when status is "approved") */
  readonly apiToken?: string;

  /** User email (only set when status is "approved") */
  readonly userEmail?: string;

  /** Token expiration time as ISO 8601 string (only set when status is "approved") */
  readonly tokenExpiresAt?: string;

  /** Error message */
  readonly error?: string;
}

/**
 * Request to verify/approve an authorization code (called from web UI).
 */
export class AuthVerifyRequestDto {
  @IsString()
  @IsNotEmpty()
  userCode?: string;
}

/**
 * Response when verifying an authorization code.
 */
export class AuthVerifyResponseDto {
  readonly success?: boolean;
  readonly error?: string;
}
