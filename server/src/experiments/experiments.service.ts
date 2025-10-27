import { Injectable } from '@nestjs/common';
import { Client, EvaluationContext, InMemoryProvider, OpenFeature } from '@openfeature/server-sdk';
import { User, UserRole } from '@prisma/client';
import { ScratchpadConfigService } from '../config/scratchpad-config.service';
import { AllFeatureFlags, ClientUserFlags, SystemFeatureFlag, UserFlag } from './flags';
import { ExperimentFlagVariantValue, FlagDataType } from './types';

export type UserFlagValues = Partial<Record<UserFlag, ExperimentFlagVariantValue>>;

// Most feature flags just need to target a specific user by their ID
export type PartialUser = Pick<User, 'id' | 'role'>;

// In-memory flags for testing. These will be replaced with Posthog or LaunchDarkly in production.
const IN_MEMORY_FLAGS = {
  [SystemFeatureFlag.SAMPLE_SYSTEM_FLAG]: {
    variants: {
      on: true,
      off: false,
    },
    disabled: false,
    defaultVariant: 'off',
  },
  [UserFlag.SAMPLE_USER_FLAG]: {
    variants: {
      on: true,
      off: false,
    },
    disabled: false,
    defaultVariant: 'off',
  },
};

@Injectable()
export class ExperimentsService {
  private client: Client;
  constructor(private readonly config: ScratchpadConfigService) {
    // TODO: replace this with Posthog or LaunchDarkly
    OpenFeature.setProvider(new InMemoryProvider(IN_MEMORY_FLAGS));
    this.client = OpenFeature.getClient();
  }

  /**
   * Convert a user into an OpenFeature context object
   * @param user - The user to create the evaluation context for
   * @returns An evaluation context for the user
   */
  private getUserContext(user: PartialUser): EvaluationContext {
    return { targetingKey: user.id };
  }

  /**
   * Evaluates all the client-facing feature flags for a given user and provides them as a single object.
   * @param user - The user to evaluate the feature flags for
   * @returns An object with the flag values for the user
   */
  public async resolveClientFeatureFlagsForUser(user: User): Promise<UserFlagValues> {
    const flagValues: UserFlagValues = {};

    // Evaluate each client-facing feature flag, along with some special ones that are not user-scoped
    for (const [key, dataType] of Object.entries(ClientUserFlags) as [UserFlag, FlagDataType][]) {
      if (key === UserFlag.DEV_TOOLBOX) {
        // Based ont he user's role, set the flag value
        flagValues[key] = user.role === UserRole.ADMIN ? true : false;
      } else if (key === UserFlag.REQUIRE_SUBSCRIPTION) {
        // get this from the config service for now
        flagValues[key] = this.config.getRequireSubscription();
      } else if (key === UserFlag.USE_JOBS) {
        // get this from the config service for now
        flagValues[key] = this.config.getUseJobs();
      } else if (dataType === 'boolean') {
        flagValues[key] = await this.getBooleanFlag(key, false, user);
      } else if (dataType === 'string') {
        flagValues[key] = await this.getStringFlag(key, '', user);
      } else if (dataType === 'number') {
        flagValues[key] = await this.getNumberFlag(key, 0, user);
      }
    }
    return flagValues;
  }

  /**
   * Gets a boolean flag value for a given feature flag
   * @param flag - The feature flag to get the value for
   * @param defaultValue - The default value to return if the flag is not set
   * @param user - Optional. The user / userId to get the flag value for
   * @returns The boolean flag value
   */
  public async getBooleanFlag(flag: AllFeatureFlags, defaultValue: boolean, user?: PartialUser): Promise<boolean> {
    if (flag in UserFlag && !user) {
      throw new Error('User ID must be provided when accessing a User-scoped feature flag');
    }
    return this.client.getBooleanValue(flag, defaultValue, user ? this.getUserContext(user) : undefined);
  }

  /**
   * Gets a string flag value for a given feature flag
   * @param flag - The feature flag to get the value for
   * @param defaultValue - The default value to return if the flag is not set
   * @param user - Optional. The user / userId to get the flag value for
   * @returns The string flag value
   */
  public async getStringFlag(flag: AllFeatureFlags, defaultValue: string, user?: PartialUser): Promise<string> {
    if (flag in UserFlag && !user) {
      throw new Error('User ID must be provided when accessing a User-scoped feature flag');
    }
    return this.client.getStringValue(flag, defaultValue, user ? this.getUserContext(user) : undefined);
  }

  /**
   * Gets a number flag value for a given feature flag
   * @param flag - The feature flag to get the value for
   * @param defaultValue - The default value to return if the flag is not set
   * @param user - Optional. The user / userId to get the flag value for
   * @returns The number flag value
   */
  public async getNumberFlag(flag: AllFeatureFlags, defaultValue: number, user?: PartialUser): Promise<number> {
    if (flag in UserFlag && !user) {
      throw new Error('User ID must be provided when accessing a User-scoped feature flag');
    }
    return this.client.getNumberValue(flag, defaultValue, user ? this.getUserContext(user) : undefined);
  }
}
