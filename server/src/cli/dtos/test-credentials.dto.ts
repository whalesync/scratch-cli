import { Service } from '@spinner/shared-types';

/**
 * Request DTO for test-credentials endpoint.
 * Connector credentials are now provided via the X-Scratch-Connector header.
 */
export class TestCredentialsDto {}

export class TestCredentialsResponseDto {
  readonly service?: Service;
  readonly success?: boolean;
  readonly error?: string;
}
