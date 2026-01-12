import { Service } from '@spinner/shared-types';
import { TablePreview } from 'src/remote-service/connectors/types';

/**
 * Request DTO for list-tables endpoint.
 * Connector credentials are now provided via the X-Scratch-Connector header.
 */
export class ListTablesDto {}

export class ListTablesResponseDto {
  readonly service?: Service;
  readonly success?: boolean;
  readonly error?: string;
  readonly tables?: TablePreview[];
}
