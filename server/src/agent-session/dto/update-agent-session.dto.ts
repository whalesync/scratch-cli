import { IsObject, IsOptional } from 'class-validator';

export class UpdateAgentSessionDto {
  @IsObject()
  @IsOptional()
  data?: any;
}
