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
import { JwtGeneratorService } from 'src/agent-jwt/jwt-generator.service';
import { ScratchpadAuthGuard } from 'src/auth/scratchpad-auth.guard';
import type { RequestWithUser } from 'src/auth/types';
import { ExperimentsService } from 'src/experiments/experiments.service';
import { getAvailableModelsForUser } from 'src/users/subscription-utils';
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
    private readonly jwtGeneratorService: JwtGeneratorService,
    private readonly experimentsService: ExperimentsService,
    private readonly subscriptionService: SubscriptionService,
    private readonly onboardingService: OnboardingService,
  ) {}

  @Get('current')
  async currentUser(@Req() req: RequestWithUser): Promise<User> {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    // Generate a JWT for the client to pass to the agent
    // Include availableModels so the agent can validate model selection
    const availableModels = getAvailableModelsForUser(req.user);
    const agentJwt = this.jwtGeneratorService.generateToken({
      userId: req.user.id,
      role: req.user.role,
      availableModels,
    });

    const flagValues = await this.experimentsService.resolveClientFeatureFlagsForUser(req.user);

    // Get monthly publish count for the organization
    const billableActions: BillableActions = {
      monthlyPublishCount: req.user.organizationId
        ? await this.subscriptionService.countMonthlyPublishActions(req.user.organizationId)
        : 0,
    };

    return new User(req.user, agentJwt, flagValues, billableActions);
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
