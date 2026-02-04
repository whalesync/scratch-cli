import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  createSubscriptionId,
  ScratchPlanType,
  SyncId,
  UpdateDevSubscriptionDto,
  UpdateSettingsDto,
  ValidatedUpdateSettingsDto,
  WorkbookId,
} from '@spinner/shared-types';
import { AgentCredentialsService } from 'src/agent-credentials/agent-credentials.service';
import { AuditLogService } from 'src/audit/audit-log.service';
import { hasAdminToolsPermission } from 'src/auth/permissions';
import { ScratchpadAuthGuard } from 'src/auth/scratchpad-auth.guard';
import type { RequestWithUser } from 'src/auth/types';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { DbService } from 'src/db/db.service';
import { getLastestExpiringSubscription } from 'src/payment/helpers';
import { getPlan, getPlanTypeFromString } from 'src/payment/plans';
import { ConnectorAccountService } from 'src/remote-service/connector-account/connector-account.service';
import { User } from 'src/users/entities/user.entity';
import { OnboardingService } from 'src/users/onboarding.service';
import { userToActor } from 'src/users/types';
import { UsersService } from 'src/users/users.service';
import { WorkbookService } from 'src/workbook/workbook.service';
import { BullEnqueuerService } from 'src/worker-enqueuer/bull-enqueuer.service';
import { DevToolsService } from './dev-tools.service';
import { UserDetail } from './entities/user-detail.entity';

interface SyncDataFoldersRequestBody {
  workbookId: WorkbookId;
  syncId: SyncId;
}

/**
 * Controller for special case dev tools
 */
@Controller('dev-tools')
@UseGuards(ScratchpadAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class DevToolsController {
  constructor(
    private readonly configService: ScratchpadConfigService,
    private readonly dbService: DbService,
    private readonly usersService: UsersService,
    private readonly snapshotService: WorkbookService,
    private readonly connectorAccountService: ConnectorAccountService,
    private readonly auditLogService: AuditLogService,
    private readonly devToolsService: DevToolsService,
    private readonly agentCredentialsService: AgentCredentialsService,
    private readonly onboardingService: OnboardingService,
    private readonly bullEnqueuerService: BullEnqueuerService,
  ) {}

  @Get('users/search')
  async searchUsers(@Query('query') query: string, @Req() req: RequestWithUser): Promise<User[]> {
    if (!hasAdminToolsPermission(req.user)) {
      throw new UnauthorizedException('Only admins can query users');
    }

    const results = await this.usersService.search(query);

    return results.map((result) => new User(result));
  }

  @Get('users/:id/details')
  async getUserDetails(@Param('id') id: string, @Req() req: RequestWithUser): Promise<UserDetail> {
    if (!hasAdminToolsPermission(req.user)) {
      throw new UnauthorizedException('Only admins can get user details');
    }

    const targetUser = await this.usersService.findOne(id);
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const actor = userToActor(targetUser);
    const snapshots = await this.snapshotService.findAllForUser(actor);
    const connectorAccounts = await this.connectorAccountService.findAll(actor);
    const auditLogs = await this.auditLogService.findEventsForUser(actor.userId, 20, undefined);
    return new UserDetail(targetUser, snapshots, connectorAccounts, auditLogs);
  }

  /* Admin tool to set user settings for a target user */
  @Patch('users/:id/settings')
  @HttpCode(204)
  async updateUserSettings(
    @Param('id') id: string,
    @Body() dtoParam: UpdateSettingsDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    const dto = dtoParam as ValidatedUpdateSettingsDto;
    if (!hasAdminToolsPermission(req.user)) {
      throw new UnauthorizedException('Only admins can update user settings');
    }

    const targetUser = await this.usersService.findOne(id);
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    await this.usersService.updateUserSettings(targetUser, dto);
  }

  /* Reset user onboarding to default state */
  @Post('users/:id/onboarding/reset')
  @HttpCode(204)
  async resetUserOnboarding(@Param('id') id: string, @Req() req: RequestWithUser): Promise<void> {
    if (!hasAdminToolsPermission(req.user)) {
      throw new UnauthorizedException('Only admins can reset user onboarding');
    }

    const targetUser = await this.usersService.findOne(id);
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    await this.onboardingService.resetOnboarding(id);
  }

  /* Subscription testing tools */
  @Post('subscription/plan/update')
  async updateUserSubscription(@Req() req: RequestWithUser, @Body() dto: UpdateDevSubscriptionDto): Promise<void> {
    if (!hasAdminToolsPermission(req.user)) {
      throw new UnauthorizedException('Only admins can cancel their developer subscription');
    }

    if (this.configService.isProductionEnvironment()) {
      throw new BadRequestException('This endpoint is only available in non-production environments');
    }
    const currentSubscription = getLastestExpiringSubscription(req.user.organization?.subscriptions ?? []);
    const planType = getPlanTypeFromString(dto.planType ?? '');
    if (!planType) {
      throw new BadRequestException(`Invalid plan type: ${dto.planType}`);
    }
    const plan = getPlan(planType);
    if (!plan) {
      throw new BadRequestException(`Invalid plan: ${dto.planType}`);
    }

    if (planType === ScratchPlanType.FREE_PLAN && !currentSubscription) {
      throw new BadRequestException('You cannot downgrade to the free plan if you do not have an active subscription');
    }

    if (currentSubscription) {
      if (planType === ScratchPlanType.FREE_PLAN) {
        // cancel the current subscription
        await this.dbService.client.subscription.update({
          where: { id: currentSubscription.id },
          data: {
            expiration: new Date(),
            stripeStatus: 'canceled',
            cancelAt: new Date(),
            lastInvoicePaid: false,
          },
        });
      } else {
        await this.dbService.client.subscription.update({
          where: { id: currentSubscription.id },
          data: {
            planType: dto.planType,
            expiration: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
            stripeStatus: 'active',
            cancelAt: null,
            lastInvoicePaid: true,
          },
        });
      }
      const existingCredential = await this.agentCredentialsService.findSystemOpenRouterCredential(req.user.id);
      if (existingCredential) {
        await this.agentCredentialsService.updateSystemOpenRouterCredentialLimit(req.user.id, plan);
      } else {
        await this.agentCredentialsService.createSystemOpenRouterCredentialsForUser(req.user.id, plan);
      }
    } else if (planType !== ScratchPlanType.FREE_PLAN) {
      // create a fake new subscription
      await this.dbService.client.subscription.create({
        data: {
          id: createSubscriptionId(),
          userId: req.user.id,
          organizationId: req.user.organizationId ?? '',
          planType: dto.planType,
          expiration: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
          stripeSubscriptionId: createSubscriptionId(), // create a fake stripe subscription id
          cancelAt: null,
          lastInvoicePaid: true,
          stripeStatus: 'active',
        },
      });

      const existingCredential = await this.agentCredentialsService.findSystemOpenRouterCredential(req.user.id);
      if (existingCredential) {
        await this.agentCredentialsService.updateSystemOpenRouterCredentialLimit(req.user.id, plan);
      } else {
        await this.agentCredentialsService.createSystemOpenRouterCredentialsForUser(req.user.id, plan);
      }
    }
  }

  @Post('subscription/plan/expire')
  async forceExpireSubscription(@Req() req: RequestWithUser): Promise<void> {
    if (!hasAdminToolsPermission(req.user)) {
      throw new UnauthorizedException('Only admins can cancel their developer subscription');
    }

    if (this.configService.isProductionEnvironment()) {
      throw new BadRequestException('This endpoint is only available in non-production environments');
    }

    const currentSubscription = getLastestExpiringSubscription(req.user.organization?.subscriptions ?? []);
    if (!currentSubscription) {
      throw new BadRequestException('You do not have an active subscription to expire');
    }

    await this.dbService.client.subscription.update({
      where: { id: currentSubscription.id },
      data: {
        expiration: new Date(),
        stripeStatus: 'expired',
        cancelAt: null,
        lastInvoicePaid: true,
      },
    });
  }
  @Post('subscription/plan/cancel')
  async forceCancelSubscription(@Req() req: RequestWithUser): Promise<void> {
    if (!hasAdminToolsPermission(req.user)) {
      throw new UnauthorizedException('Only admins can cancel their developer subscription');
    }

    if (this.configService.isProductionEnvironment()) {
      throw new BadRequestException('This endpoint is only available in non-production environments');
    }

    const currentSubscription = getLastestExpiringSubscription(req.user.organization?.subscriptions ?? []);
    if (!currentSubscription) {
      throw new BadRequestException('You do not have an active subscription to cance');
    }

    const newCancelDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);

    await this.dbService.client.subscription.update({
      where: { id: currentSubscription.id },
      data: {
        expiration: newCancelDate,
        cancelAt: newCancelDate,
        stripeStatus: 'active',
        lastInvoicePaid: true,
      },
    });
  }

  /* Sync data folders job trigger */
  @Post('jobs/sync-data-folders')
  async syncDataFoldersJob(@Body() body: SyncDataFoldersRequestBody, @Req() req: RequestWithUser) {
    if (!hasAdminToolsPermission(req.user)) {
      throw new UnauthorizedException('Only admins can trigger sync data folders jobs');
    }

    // Look up workbook to get userId and organizationId
    const workbook = await this.dbService.client.workbook.findUnique({
      where: { id: body.workbookId },
      select: { userId: true, organizationId: true },
    });

    if (!workbook) {
      throw new NotFoundException(`Workbook ${body.workbookId} not found`);
    }

    const job = await this.bullEnqueuerService.enqueueSyncDataFoldersJob(body.workbookId, body.syncId, {
      userId: workbook.userId ?? req.user.id,
      organizationId: workbook.organizationId,
    });

    return {
      success: true,
      jobId: job.id,
      message: 'Sync data folders job queued successfully',
    };
  }
}
