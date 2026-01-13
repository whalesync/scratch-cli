import { Service } from '@spinner/shared-types';
import { TableInfo } from '../entities/table-info.entity';

export class ListTablesResponseDto {
  readonly service?: Service;
  readonly success?: boolean;
  readonly error?: string;
  readonly tables?: TableInfo[];
}
