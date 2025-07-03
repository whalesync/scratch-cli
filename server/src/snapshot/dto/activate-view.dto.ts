import { IsArray, IsIn, IsString } from 'class-validator';

export class ActivateViewDto {
  @IsIn(['ui', 'agent'])
  source: 'ui' | 'agent';

  @IsArray()
  @IsString({ each: true })
  recordIds: string[];
}
