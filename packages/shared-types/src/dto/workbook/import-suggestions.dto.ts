import { IsBoolean, IsOptional } from 'class-validator';

export class ImportSuggestionsDto {
  @IsOptional()
  @IsBoolean()
  firstRowIsHeader?: boolean;
}

export class ImportSuggestionsResponseDto {
  recordsProcessed?: number;
  suggestionsCreated?: number;
}

export type ValidatedImportSuggestionsDto = ImportSuggestionsDto;
