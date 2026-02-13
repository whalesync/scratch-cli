import { IsNotEmpty, IsObject, IsString } from 'class-validator';
import { TransformerType } from '../../sync-mapping';
import { FieldMapType } from './create-sync.dto';

export class PreviewRecordDto {
  @IsString()
  @IsNotEmpty()
  sourceId!: string;

  @IsString()
  @IsNotEmpty()
  filePath!: string;

  @IsObject()
  @IsNotEmpty()
  fieldMap!: FieldMapType;
}

export interface PreviewFieldResult {
  sourceField: string;
  destinationField: string;
  sourceValue: unknown;
  transformedValue: unknown;
  transformerType?: TransformerType;
  warning?: string;
}

export interface PreviewRecordResponse {
  recordId: string;
  fields: PreviewFieldResult[];
}
