import { IsArray, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

export type RecordOperation =
  | CreateRecordOperation
  | UpdateRecordOperation
  | DeleteRecordOperation
  | UndeleteRecordOperation;

export class CreateRecordOperation {
  @IsIn(['create'])
  op?: 'create';

  @IsObject()
  data?: Record<string, unknown>;
}

export class UpdateRecordOperation {
  @IsIn(['update'])
  op?: 'update';

  @IsString()
  @IsNotEmpty()
  wsId?: string;

  @IsObject()
  @IsNotEmpty()
  data?: Record<string, unknown>;
}

export class DeleteRecordOperation {
  @IsIn(['delete'])
  op?: 'delete';

  @IsString()
  @IsNotEmpty()
  wsId?: string;
}

export class UndeleteRecordOperation {
  @IsIn(['undelete'])
  op?: 'undelete';

  @IsString()
  @IsNotEmpty()
  wsId?: string;
}

export class BulkUpdateRecordsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  creates?: CreateRecordOperation[];

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  updates?: UpdateRecordOperation[];

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  deletes?: DeleteRecordOperation[];

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  undeletes?: UndeleteRecordOperation[];
}

export type ValidatedCreateRecordOperation = Required<CreateRecordOperation>;
export type ValidatedUpdateRecordOperation = Required<UpdateRecordOperation>;
export type ValidatedDeleteRecordOperation = Required<DeleteRecordOperation>;
export type ValidatedUndeleteRecordOperation = Required<UndeleteRecordOperation>;
export type ValidatedBulkUpdateRecordsDto = BulkUpdateRecordsDto;
