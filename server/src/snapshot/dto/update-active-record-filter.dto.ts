import { IsArray, IsString } from 'class-validator';

export class UpdateActiveRecordFilterDto {
  @IsArray()
  @IsString({ each: true })
  recordIds: string[];
}
