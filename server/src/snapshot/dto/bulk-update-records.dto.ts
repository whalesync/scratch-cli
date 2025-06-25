import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNotEmpty, IsObject, IsString, ValidateNested } from 'class-validator';

export class RecordOperation {
  @IsIn(['create', 'update', 'delete'])
  op: 'create' | 'update' | 'delete';

  @IsString()
  @IsNotEmpty()
  id: string;

  @IsObject()
  data?: Record<string, unknown>;
}

export class BulkUpdateRecordsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecordOperation)
  ops: RecordOperation[];
}
