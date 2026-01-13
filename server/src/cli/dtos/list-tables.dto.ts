import { TableInfo } from '../entities/table-info.entity';

export class ListTablesResponseDto {
  readonly error?: string;
  readonly tables?: TableInfo[];
}
