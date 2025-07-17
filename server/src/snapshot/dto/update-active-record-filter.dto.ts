import { IsArray, IsString } from 'class-validator';

export class SetActiveRecordsFilterDto {
  @IsArray()
  @IsString({ each: true })
  recordIds: string[];
}
