import { IsOptional, IsString } from 'class-validator';

export class TriggerDownloadDto {
  @IsOptional()
  @IsString()
  dataFolderId?: string;
}

export class TriggerDownloadResponseDto {
  readonly jobId?: string;
  readonly error?: string;
}
