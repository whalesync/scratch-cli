import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateAgentTokenUsageEventDto {
  @IsString()
  @IsNotEmpty()
  credentialId?: string;

  @IsString()
  @IsNotEmpty()
  model?: string;

  @IsInt()
  @Min(0)
  requests?: number;

  @IsInt()
  @Min(0)
  requestTokens?: number;

  @IsInt()
  @Min(0)
  responseTokens?: number;

  @IsInt()
  @Min(0)
  totalTokens?: number;

  @IsOptional()
  context?: Record<string, any>;
}

export type ValidatedCreateAgentTokenUsageEventDto = Required<
  Pick<
    CreateAgentTokenUsageEventDto,
    'credentialId' | 'model' | 'requests' | 'requestTokens' | 'responseTokens' | 'totalTokens'
  >
> &
  Pick<CreateAgentTokenUsageEventDto, 'context'>;
