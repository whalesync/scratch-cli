import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateWorkbookDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  name?: string;
}

export type ValidatedUpdateWorkbookDto = UpdateWorkbookDto;
