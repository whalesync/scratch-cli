import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateSnapshotDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  name?: string;
}
