import { Service } from '@spinner/shared-types';

export class TestCredentialsResponseDto {
  readonly service?: Service;
  readonly success?: boolean;
  readonly error?: string;
}
