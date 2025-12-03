import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { BillableActions } from '@spinner/shared-types';
import { JwtGeneratorService } from 'src/agent-jwt/jwt-generator.service';
import { ScratchpadAuthGuard } from 'src/auth/scratchpad-auth.guard';
import type { RequestWithUser } from 'src/auth/types';
import { ExperimentsService } from 'src/experiments/experiments.service';
import { UpdateSettingsDto, ValidatedUpdateSettingsDto } from './dto/update-settings.dto';
import { User } from './entities/user.entity';
import { SubscriptionService } from './subscription.service';
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
  ) {}

  @Get('current')
  async currentUser(@Req() req: RequestWithUser): Promise<User> {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    // Generate a JWT for the client to pass to the agent
    const agentJwt = this.jwtGeneratorService.generateToken({
      userId: req.user.id,
      role: req.user.role,
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
}
