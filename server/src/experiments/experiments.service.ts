import { Injectable } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { ScratchpadConfigService } from '../config/scratchpad-config.service';
import { UserExperimentFlag } from './flags';
import { ExperimentFlagVariantValue } from './types';

export type UserExperimentFlagValues = Partial<Record<UserExperimentFlag, ExperimentFlagVariantValue>>;

type PartialUser = Pick<User, 'id' | 'email' | 'role'>;

@Injectable()
export class ExperimentsService {
  constructor(private readonly config: ScratchpadConfigService) {}

  /** Returns a list of ALL UserExperimentFlags that resolve for a user. */
  resolveFlagsForUser(user: User): UserExperimentFlagValues {
    const r: UserExperimentFlagValues = {};
    for (const e of Object.values(UserExperimentFlag)) {
      // Only include the ones that have a value.
      r[e] = this.getFlagValueForUser(e, user, undefined);
    }
    return r;
  }

  /**
   * TODO - actually implement this with a FeatureFlag service liek Posthog or LaunchDarkly
   * @param flag
   * @param user
   * @param defaultValue
   * @returns
   */
  getFlagValueForUser<T extends ExperimentFlagVariantValue>(
    flag: UserExperimentFlag,
    user: PartialUser,
    defaultValue: T,
  ): T {
    if (flag === UserExperimentFlag.DEV_TOOLBOX && user.role === UserRole.ADMIN) {
      return true as T;
    }
    if (flag === UserExperimentFlag.REQUIRE_SUBSCRIPTION) {
      return (this.config.getRequireSubscription() === 'true') as T;
    }
    return defaultValue;
  }
}
