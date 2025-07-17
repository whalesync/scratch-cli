import { IsArray, IsString } from 'class-validator';

export class AddActiveRecordFilterDto {
  @IsArray()
  @IsString({ each: true })
  recordIds: string[];
}
