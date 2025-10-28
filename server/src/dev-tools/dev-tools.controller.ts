import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuditLogService } from 'src/audit/audit-log.service';
import { hasAdminToolsPermission } from 'src/auth/permissions';
import { ScratchpadAuthGuard } from 'src/auth/scratchpad-auth.guard';
import { RequestWithUser } from 'src/auth/types';
import { ConnectorAccountService } from 'src/remote-service/connector-account/connector-account.service';
import { SnapshotService } from 'src/snapshot/snapshot.service';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { DevToolsService } from './dev-tools.service';
import { UserDetail } from './entities/user-detail.entity';

/**
 * Controller for special case dev tools
 */
@Controller('dev-tools')
export class DevToolsController {
  constructor(
    private readonly usersService: UsersService,
    private readonly snapshotService: SnapshotService,
    private readonly connectorAccountService: ConnectorAccountService,
    private readonly auditLogService: AuditLogService,
    private readonly devToolsService: DevToolsService,
  ) {}

  @UseGuards(ScratchpadAuthGuard)
  @Get('users/search')
  async searchUsers(@Query('query') query: string, @Req() req: RequestWithUser): Promise<User[]> {
    if (!hasAdminToolsPermission(req.user)) {
      throw new UnauthorizedException('Only admins can query users');
    }

    const results = await this.usersService.search(query);

    return results.map((result) => new User(result));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Get('users/:id/details')
  async getUserDetails(@Param('id') id: string, @Req() req: RequestWithUser): Promise<UserDetail> {
    if (!hasAdminToolsPermission(req.user)) {
      throw new UnauthorizedException('Only admins can get user details');
    }

    const user = await this.usersService.findOne(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const snapshots = await this.snapshotService.findAllForUser(id);
    const connectorAccounts = await this.connectorAccountService.findAll(id);
    const auditLogs = await this.auditLogService.findEventsForUser(id, 20, undefined);
    return new UserDetail(user, snapshots, connectorAccounts, auditLogs);
  }

  /**
   * Temporary endpoing to reset the stripe customer and subscription for a user for migrating from one stripe account to a new one
   * See DEV-8698 in Linear
   * Remove after migration is complete
   */
  @UseGuards(ScratchpadAuthGuard)
  @Get('users/:id/reset-stripe')
  async resetStripeForUser(@Param('id') id: string, @Req() req: RequestWithUser): Promise<string> {
    if (!hasAdminToolsPermission(req.user)) {
      throw new UnauthorizedException('Only admins can reset stripe customer and subscription for a user');
    }
    return await this.devToolsService.resetStripeCustomerForUser(id);
  }
}
