import { Service } from '@spinner/shared-types';
import { AnyTableSpec } from 'src/remote-service/connectors/library/custom-spec-registry';

/**
 * Request DTO for list-table-specs endpoint.
 * Connector credentials are now provided via the X-Scratch-Connector header.
 */
export class ListTableSpecsDto {}

export class ListTableSpecsResponseDto {
  readonly service?: Service;
  readonly success?: boolean;
  readonly error?: string;
  readonly tables?: AnyTableSpec[];
}
