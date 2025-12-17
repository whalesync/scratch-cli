import { IsOptional, IsString } from 'class-validator';

export class CreateBugReportDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  bugType?: string;

  @IsString()
  @IsOptional()
  userDescription?: string;

  @IsString()
  @IsOptional()
  replayUrl?: string;

  @IsString()
  @IsOptional()
  sessionId?: string;

  @IsString()
  @IsOptional()
  pageUrl?: string;

  @IsString()
  @IsOptional()
  workbookId?: string;

  @IsString()
  @IsOptional()
  snapshotTableId?: string;

  @IsOptional()
  additionalContext?: Record<string, any>;
}

export type ValidatedCreateBugReportDto = Required<
  Pick<CreateBugReportDto, 'title' | 'bugType' | 'userDescription' | 'pageUrl'>
> &
  Pick<CreateBugReportDto, 'additionalContext' | 'replayUrl' | 'sessionId' | 'workbookId' | 'snapshotTableId'>;
