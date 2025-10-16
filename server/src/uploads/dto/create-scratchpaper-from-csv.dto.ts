import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateScratchpaperFromCsvDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  titleColumnRemoteId?: string[];
}

export class CreateScratchpaperFromCsvResponseDto {
  snapshotId: string;
  tableId: string;
}
