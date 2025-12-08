import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { UserOnboarding } from './types';

@Injectable()
export class OnboardingService {
  constructor(private readonly db: DbService) {}

  /**
   * Updates a specific onboarding flow for a user.
   * Loads the current onboarding state, applies the partial update, and saves.
   *
   * @param userId - The user's ID
   * @param flowCode - The onboarding flow code (e.g., 'gettingStartedV1')
   * @param update - Partial update to apply to the flow state
   */
  async updateOnboardingFlow<K extends keyof UserOnboarding>(
    userId: string,
    flowCode: K,
    update: Partial<UserOnboarding[K]>,
  ): Promise<void> {
    const user = await this.db.client.user.findUnique({
      where: { id: userId },
      select: { onboarding: true },
    });

    const currentOnboarding = (user?.onboarding ?? {}) as UserOnboarding;
    const currentFlowState = currentOnboarding[flowCode] ?? {};

    const updatedOnboarding: UserOnboarding = {
      ...currentOnboarding,
      [flowCode]: {
        ...currentFlowState,
        ...update,
      },
    };

    await this.db.client.user.update({
      where: { id: userId },
      data: { onboarding: updatedOnboarding as object },
    });
  }
}
