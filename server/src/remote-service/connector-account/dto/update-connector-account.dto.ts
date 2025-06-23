import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateConnectorAccountDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  readonly displayName?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  readonly apiKey?: string;
}
