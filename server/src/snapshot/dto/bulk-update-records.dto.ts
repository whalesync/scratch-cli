import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNotEmpty, IsObject, IsString, ValidateNested } from 'class-validator';

export type RecordOperation = CreateRecordOperation | UpdateRecordOperation | DeleteRecordOperation;

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

export class BulkUpdateRecordsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object, {
    discriminator: {
      property: 'op',
      subTypes: [
        { value: CreateRecordOperation, name: 'create' },
        { value: UpdateRecordOperation, name: 'update' },
        { value: DeleteRecordOperation, name: 'delete' },
      ],
    },
  })
  ops: (CreateRecordOperation | UpdateRecordOperation | DeleteRecordOperation)[];
}
