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
import { BillableActions, UpdateSettingsDto, ValidatedUpdateSettingsDto } from '@spinner/shared-types';
import { ScratchAuthGuard } from 'src/auth/scratch-auth.guard';
import type { RequestWithUser } from 'src/auth/types';
import { ExperimentsService } from 'src/experiments/experiments.service';
import { User } from './entities/user.entity';
import { SubscriptionService } from './subscription.service';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(ScratchAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly experimentsService: ExperimentsService,
    private readonly subscriptionService: SubscriptionService,
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

  @Post('current/api-token')
  async generateApiToken(@Req() req: RequestWithUser): Promise<{ apiToken: string }> {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    const apiToken = await this.usersService.generateUserApiToken(req.user.id);
    return { apiToken };
  }
}
