import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { AgentService } from '../../agent-credentials';

export class CreateAgentCredentialDto {
  @IsString()
  service?: AgentService;

  @IsString()
  apiKey?: string;

  @IsString()
  name?: string;

  @IsNumber()
  @IsOptional()
  tokenUsageWarningLimit?: number | null;

  @IsBoolean()
  @IsOptional()
  default?: boolean;
}

export type ValidatedCreateAgentCredentialDto = Required<
  Pick<CreateAgentCredentialDto, 'service' | 'apiKey' | 'name'>
> &
  Pick<CreateAgentCredentialDto, 'tokenUsageWarningLimit' | 'default'>;
