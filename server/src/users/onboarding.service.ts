import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { DEFAULT_GETTING_STARTED_V1, DEFAULT_STEP_STATE, GettingStartedV1StepKey, UserOnboarding } from './types';

@Injectable()
export class OnboardingService {
  constructor(private readonly db: DbService) {}

  /**
   * Resets the onboarding state for a user to the default values.
   *
   * @param userId - The user's ID
   */
  async resetOnboarding(userId: string): Promise<void> {
    const defaultOnboarding: UserOnboarding = {
      gettingStartedV1: DEFAULT_GETTING_STARTED_V1,
    };

    await this.db.client.user.update({
      where: { id: userId },
      data: { onboarding: defaultOnboarding as object },
    });
  }

  /**
   * Marks a step as completed in the specified onboarding flow.
   *
   * @param userId - The user's ID
   * @param flow - The flow key (e.g., 'gettingStartedV1')
   * @param stepKey - The step key to mark as completed
   */
  async markStepCompleted(userId: string, flow: keyof UserOnboarding, stepKey: GettingStartedV1StepKey): Promise<void> {
    const user = await this.db.client.user.findUnique({
      where: { id: userId },
      select: { onboarding: true },
    });

    const currentOnboarding = (user?.onboarding ?? {}) as UserOnboarding;
    const currentFlow = currentOnboarding[flow] ?? DEFAULT_GETTING_STARTED_V1;
    const currentStepState = currentFlow[stepKey] ?? DEFAULT_STEP_STATE;

    const updatedOnboarding: UserOnboarding = {
      ...currentOnboarding,
      [flow]: {
        ...currentFlow,
        [stepKey]: {
          ...currentStepState,
          completed: true,
        },
      },
    };

    await this.db.client.user.update({
      where: { id: userId },
      data: {
        onboarding: updatedOnboarding as object,
        onboardingWorkbookId: null, // Clear onboarding workbook redirect when a step is completed
      },
    });
  }

  /**
   * Completes a flow by removing it from the onboarding state.
   *
   * @param userId - The user's ID
   * @param flow - The flow key (e.g., 'gettingStartedV1')
   */
  async completeFlow(userId: string, flow: keyof UserOnboarding): Promise<void> {
    const user = await this.db.client.user.findUnique({
      where: { id: userId },
      select: { onboarding: true },
    });

    const currentOnboarding = (user?.onboarding ?? {}) as UserOnboarding;

    // Remove the flow key from onboarding
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [flow]: _removed, ...updatedOnboarding } = currentOnboarding;

    await this.db.client.user.update({
      where: { id: userId },
      data: { onboarding: updatedOnboarding as object },
    });
  }

  /**
   * Collapses or expands a step in the specified onboarding flow.
   *
   * @param userId - The user's ID
   * @param flow - The flow key (e.g., 'gettingStartedV1')
   * @param stepKey - The step key to collapse/expand
   * @param collapsed - Whether the step should be collapsed
   */
  async setStepCollapsed(
    userId: string,
    flow: keyof UserOnboarding,
    stepKey: GettingStartedV1StepKey,
    collapsed: boolean,
  ): Promise<void> {
    const user = await this.db.client.user.findUnique({
      where: { id: userId },
      select: { onboarding: true },
    });

    const currentOnboarding = (user?.onboarding ?? {}) as UserOnboarding;
    const currentFlow = currentOnboarding[flow] ?? DEFAULT_GETTING_STARTED_V1;
    const currentStepState = currentFlow[stepKey] ?? DEFAULT_STEP_STATE;

    const updatedOnboarding: UserOnboarding = {
      ...currentOnboarding,
      [flow]: {
        ...currentFlow,
        [stepKey]: {
          ...currentStepState,
          collapsed,
        },
      },
    };

    await this.db.client.user.update({
      where: { id: userId },
      data: { onboarding: updatedOnboarding as object },
    });
  }
}
