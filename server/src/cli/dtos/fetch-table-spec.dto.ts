import { Service } from '@spinner/shared-types';
import { AnyTableSpec } from 'src/remote-service/connectors/library/custom-spec-registry';

export class FetchTableSpecResponseDto {
  readonly service?: Service;
  readonly success?: boolean;
  readonly error?: string;
  readonly tableSpec?: AnyTableSpec;
}
