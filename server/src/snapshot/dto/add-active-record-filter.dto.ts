import { IsArray, IsString } from 'class-validator';

export class AddRecordsToActiveFilterDto {
  @IsArray()
  @IsString({ each: true })
  recordIds: string[];
}
