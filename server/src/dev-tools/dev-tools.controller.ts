import {
  Body,
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
} from '@nestjs/common';
import { AuditLogService } from 'src/audit/audit-log.service';
import { hasAdminToolsPermission } from 'src/auth/permissions';
import { ScratchpadAuthGuard } from 'src/auth/scratchpad-auth.guard';
import type { RequestWithUser } from 'src/auth/types';
import { ConnectorAccountService } from 'src/remote-service/connector-account/connector-account.service';
import { UploadsDbService } from 'src/uploads/uploads-db.service';
import { UpdateSettingsDto } from 'src/users/dto/update-settings.dto';
import { User } from 'src/users/entities/user.entity';
import { userToActor } from 'src/users/types';
import { UsersService } from 'src/users/users.service';
import { WorkbookService } from 'src/workbook/workbook.service';
import { DevToolsService } from './dev-tools.service';
import { UserDetail } from './entities/user-detail.entity';

/**
 * Controller for special case dev tools
 */
@Controller('dev-tools')
@UseGuards(ScratchpadAuthGuard)
export class DevToolsController {
  constructor(
    private readonly usersService: UsersService,
    private readonly snapshotService: WorkbookService,
    private readonly connectorAccountService: ConnectorAccountService,
    private readonly auditLogService: AuditLogService,
    private readonly devToolsService: DevToolsService,
    private readonly uploadsDbService: UploadsDbService,
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
    @Body() dto: UpdateSettingsDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    if (!hasAdminToolsPermission(req.user)) {
      throw new UnauthorizedException('Only admins can update user settings');
    }

    const targetUser = await this.usersService.findOne(id);
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    await this.usersService.updateUserSettings(targetUser, dto);
  }

  /* Admin tool to add "new user" resources to the target user like a trial subscription and openrouter key */
  @Post('users/:id/add-new-user-resources')
  async addNewUserResources(@Req() req: RequestWithUser, @Param('id') id: string): Promise<boolean> {
    if (!hasAdminToolsPermission(req.user)) {
      throw new UnauthorizedException('Only admins can add new user resources');
    }

    const user = await this.usersService.findOne(id);

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    await this.usersService.addNewUserResources(user);

    return true;
  }
}
