import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuditLogService } from 'src/audit/audit-log.service';
import { hasAdminToolsPermission } from 'src/auth/permissions';
import { ScratchpadAuthGuard } from 'src/auth/scratchpad-auth.guard';
import { RequestWithUser, toActor } from 'src/auth/types';
import { ConnectorAccountService } from 'src/remote-service/connector-account/connector-account.service';
import { SnapshotService } from 'src/snapshot/snapshot.service';
import { SnapshotId } from 'src/types/ids';
import { UploadsDbService } from 'src/uploads/uploads-db.service';
import { User } from 'src/users/entities/user.entity';
import { Actor, userToActor } from 'src/users/types';
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
    private readonly uploadsDbService: UploadsDbService,
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

  /*
    Temporary endpoint to migrate old style snapshots to new Workbooks
  */
  @UseGuards(ScratchpadAuthGuard)
  @Post('snapshots/fix-user')
  async fixUser(@Req() req: RequestWithUser): Promise<{ migratedSnapshots: number; tablesCreated: number }> {
    return this.snapshotService.migrateUserSnapshots(toActor(req.user));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Get('snapshots/old-style-snapshots')
  async listOldStyleSnapshots(@Req() req: RequestWithUser): Promise<
    Array<{
      id: string;
      name: string | null;
      service: string;
      userId: string;
      createdAt: Date;
      updatedAt: Date;
      tableSpecsCount: number;
      snapshotTablesCount: number;
    }>
  > {
    if (!hasAdminToolsPermission(req.user)) {
      throw new UnauthorizedException('Only admins can list old-style snapshots');
    }
    return this.snapshotService.listOldStyleSnapshots();
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post('snapshots/fix-snapshot/:id')
  async fixSnapshot(
    @Param('id') id: SnapshotId,
    @Req() req: RequestWithUser,
  ): Promise<{ success: boolean; tablesCreated: number }> {
    if (!hasAdminToolsPermission(req.user)) {
      throw new UnauthorizedException('Only admins can fix snapshots');
    }
    return this.snapshotService.migrateSnapshot(id);
  }

  /**
   * Temporary endpoint to migrate old style uploads to new organizations
   */
  @UseGuards(ScratchpadAuthGuard)
  @Get('uploads/migrate-to-organization')
  async migrateUploadsToOrganization(@Req() req: RequestWithUser): Promise<{ actor: Actor; result: string }[]> {
    if (!hasAdminToolsPermission(req.user)) {
      throw new UnauthorizedException('Only admins can use this bulk migration tool');
    }

    const users = await this.usersService.search('usr_'); // easy way to find all users
    const actors = users.map((user) => userToActor(user));
    return this.uploadsDbService.devToolMigrateUploadsToOrganizationId(actors);
  }
}
