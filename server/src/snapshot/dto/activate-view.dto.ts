import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateSnapshotTableViewDto {
  @IsIn(['ui', 'agent'])
  source: 'ui' | 'agent';

  @IsString()
  @IsOptional()
  name?: string;

  @IsArray()
  @IsString({ each: true })
  recordIds: string[];
}
