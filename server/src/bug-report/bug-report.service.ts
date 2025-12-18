import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateBugReportDto } from '@spinner/shared-types';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { UserCluster } from 'src/db/cluster-types';
import { getSubscriptionPlanType } from 'src/payment/helpers';
import { LinearService } from './linear.service';

@Injectable()
export class BugReportService {
  constructor(
    private readonly configService: ScratchpadConfigService,
    private readonly linearService: LinearService,
  ) {}

  async create(
    createBugReportDto: CreateBugReportDto,
    user: UserCluster.User,
  ): Promise<{ issueId: string | undefined; link: string | undefined }> {
    const title = `${createBugReportDto.title ?? 'User bug report'}`;

    const userDashboardUrl = `${this.configService.getScratchApplicationUrl()}/dev/users?q=${user.id}`;

    let description = '';
    description += `**Env**: ${this.configService.getScratchpadEnvironment()}\n`;
    if (createBugReportDto.bugType) {
      description += `**Bug Type**: ${createBugReportDto.bugType}\n`;
    }
    if (createBugReportDto.pageUrl) {
      description += `**Page**: ${createBugReportDto.pageUrl}\n`;
    }
    if (createBugReportDto.replayUrl) {
      description += `**Posthog Session**: [View Replay](${createBugReportDto.replayUrl})\n`;
    }

    // User information
    description += `
## User
**ID**: [${user.id}](${userDashboardUrl})
**Name**: ${user.name}
**Email**: ${user.email}
**Subscription**: ${getSubscriptionPlanType(user)}
`;

    // Bug Report information
    description += `\n## Details\n`;

    description += `${createBugReportDto.userDescription ?? 'No description provided'}\n`;

    // Additional context
    if (createBugReportDto.workbookId || createBugReportDto.snapshotTableId || createBugReportDto.additionalContext) {
      description += `\n## Additional Context\n`;

      if (createBugReportDto.workbookId) {
        description += `**Workbook**: ${createBugReportDto.workbookId}\n`;
      }

      if (createBugReportDto.snapshotTableId) {
        description += `**Snapshot Table**: ${createBugReportDto.snapshotTableId}\n`;
      }

      description += `${createBugReportDto.additionalContext && Object.keys(createBugReportDto.additionalContext).length > 0 ? JSON.stringify(createBugReportDto.additionalContext, null, 2) : ''}\n`;

      // TODO: break down the additional context into sections once whe know what kind of things are stored there
    }
    try {
      const { issueId, link } = await this.linearService.createIssue(title, description);

      return { issueId, link };
    } catch (error) {
      throw new InternalServerErrorException('Error creating bug report', { cause: error });
    }
  }
}
