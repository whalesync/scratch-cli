import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateAiAgentTokenUsageEventDto {
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

export type ValidatedCreateAiAgentTokenUsageEventDto = Required<
  Pick<CreateAiAgentTokenUsageEventDto, 'model' | 'requests' | 'requestTokens' | 'responseTokens' | 'totalTokens'>
> &
  Pick<CreateAiAgentTokenUsageEventDto, 'context'>;
