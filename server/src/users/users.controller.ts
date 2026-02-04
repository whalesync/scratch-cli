import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  BillableActions,
  CollapseOnboardingStepDto,
  UpdateSettingsDto,
  ValidatedCollapseOnboardingStepDto,
  ValidatedUpdateSettingsDto,
} from '@spinner/shared-types';
import { ScratchpadAuthGuard } from 'src/auth/scratchpad-auth.guard';
import type { RequestWithUser } from 'src/auth/types';
import { ExperimentsService } from 'src/experiments/experiments.service';
import { User } from './entities/user.entity';
import { OnboardingService } from './onboarding.service';
import { SubscriptionService } from './subscription.service';
import { GettingStartedV1StepKey, UserOnboarding } from './types';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(ScratchpadAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly experimentsService: ExperimentsService,
    private readonly subscriptionService: SubscriptionService,
    private readonly onboardingService: OnboardingService,
  ) {}

  @Get('current')
  async currentUser(@Req() req: RequestWithUser): Promise<User> {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    const flagValues = await this.experimentsService.resolveClientFeatureFlagsForUser(req.user);

    // Get monthly publish count for the organization
    const billableActions: BillableActions = {
      monthlyPublishCount: req.user.organizationId
        ? await this.subscriptionService.countMonthlyPublishActions(req.user.organizationId)
        : 0,
    };

    return new User(req.user, flagValues, billableActions);
  }

  @Patch('current/settings')
  @HttpCode(204)
  async updateUserSettings(@Req() req: RequestWithUser, @Body() updateSettingsDto: UpdateSettingsDto): Promise<void> {
    const dto = updateSettingsDto as ValidatedUpdateSettingsDto;
    const user = await this.usersService.findOne(req.user.id);

    if (!user) {
      throw new NotFoundException(`User ${req.user.id} not found`);
    }

    await this.usersService.updateUserSettings(user, dto);
  }

  @Post('current/onboarding/collapse')
  @HttpCode(204)
  async collapseOnboardingStep(@Req() req: RequestWithUser, @Body() dto: CollapseOnboardingStepDto): Promise<void> {
    const validatedDto = dto as ValidatedCollapseOnboardingStepDto;
    await this.onboardingService.setStepCollapsed(
      req.user.id,
      validatedDto.flow as keyof UserOnboarding,
      validatedDto.stepKey as GettingStartedV1StepKey,
      validatedDto.collapsed,
    );
  }
}
