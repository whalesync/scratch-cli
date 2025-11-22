import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateWorkbookFromCsvDto {
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  titleColumnRemoteId?: string[];
}

export class CreateWorkbookFromCsvResponseDto {
  workbookId?: string;
  tableId?: string;
}

export type ValidatedCreateWorkbookFromCsvDto = Required<Pick<CreateWorkbookFromCsvDto, 'name'>> &
  Pick<CreateWorkbookFromCsvDto, 'titleColumnRemoteId'>;
