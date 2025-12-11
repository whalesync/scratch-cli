import { IsArray, IsOptional, IsString } from 'class-validator';

export class DeepFetchRecordsDto {
  @IsArray()
  @IsString({ each: true })
  recordIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fields?: string[] | null;
}

export type ValidatedDeepFetchRecordsDto = Required<Pick<DeepFetchRecordsDto, 'recordIds'>> &
  Pick<DeepFetchRecordsDto, 'fields'>;
