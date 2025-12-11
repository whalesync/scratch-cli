import { IsInt, IsOptional, Min } from 'class-validator';

export class SetTableViewStateDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  pageSize?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  currentSkip?: number | null;
}

export type ValidatedSetPageSizeDto = SetTableViewStateDto;
