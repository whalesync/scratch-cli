import { IsInt, IsOptional, Min } from 'class-validator';

export class SetPageSizeDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  pageSize?: number | null;
}
