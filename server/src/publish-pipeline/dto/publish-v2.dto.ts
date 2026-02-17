import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PlanPublishV2Dto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsOptional()
  connectorAccountId?: string;
}

export class RunPublishV2Dto {
  @IsString()
  @IsNotEmpty()
  pipelineId!: string;
}
