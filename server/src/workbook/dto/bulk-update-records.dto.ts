import { IsArray, IsIn, IsNotEmpty, IsObject, IsString, ValidateNested } from 'class-validator';

export type RecordOperation =
  | CreateRecordOperation
  | UpdateRecordOperation
  | DeleteRecordOperation
  | UndeleteRecordOperation;

export class CreateRecordOperation {
  @IsIn(['create'])
  op: 'create';

  @IsObject()
  data: Record<string, unknown>;
}

export class UpdateRecordOperation {
  @IsIn(['update'])
  op: 'update';

  @IsString()
  @IsNotEmpty()
  wsId: string;

  @IsObject()
  @IsNotEmpty()
  data: Record<string, unknown>;
}

export class DeleteRecordOperation {
  @IsIn(['delete'])
  op: 'delete';

  @IsString()
  @IsNotEmpty()
  wsId: string;
}

export class UndeleteRecordOperation {
  @IsIn(['undelete'])
  op: 'undelete';

  @IsString()
  @IsNotEmpty()
  wsId: string;
}

export class BulkUpdateRecordsDto {
  @IsArray()
  @ValidateNested({ each: true })
  creates: CreateRecordOperation[];

  @IsArray()
  @ValidateNested({ each: true })
  updates: UpdateRecordOperation[];

  @IsArray()
  @ValidateNested({ each: true })
  deletes: DeleteRecordOperation[];

  @IsArray()
  @ValidateNested({ each: true })
  undeletes: UndeleteRecordOperation[];
}
