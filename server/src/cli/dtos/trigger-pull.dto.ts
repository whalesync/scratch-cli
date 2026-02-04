import { IsOptional, IsString } from 'class-validator';

export class TriggerPullDto {
  @IsOptional()
  @IsString()
  dataFolderId?: string;
}

export class TriggerPullResponseDto {
  readonly jobId?: string;
  readonly error?: string;
}
