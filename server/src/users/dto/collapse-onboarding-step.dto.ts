import { IsBoolean, IsIn, IsString } from 'class-validator';

const VALID_FLOWS = ['gettingStartedV1'] as const;
const VALID_STEP_KEYS = ['dataSourceConnected', 'contentEditedWithAi', 'suggestionsAccepted', 'dataPublished'] as const;

export class CollapseOnboardingStepDto {
  @IsString()
  @IsIn(VALID_FLOWS)
  flow?: string;

  @IsString()
  @IsIn(VALID_STEP_KEYS)
  stepKey?: string;

  @IsBoolean()
  collapsed?: boolean;
}

export type ValidatedCollapseOnboardingStepDto = Required<CollapseOnboardingStepDto>;
