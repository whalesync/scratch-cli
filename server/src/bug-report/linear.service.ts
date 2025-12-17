import { LinearClient } from '@linear/sdk';
import { Injectable } from '@nestjs/common';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { WSLogger } from 'src/logger';

const LINEAR_DEV_TEAM_ID = 'b4e2b7f8-c4c2-4aaa-848c-e306f07c1a8f';
const LINEAR_SCRATCH_PROJECT_ID = '28999d63-a6a4-41ab-9ce9-ba55027f5aae';
const LINEAR_BUG_TEMPLATE_ID = '0ea48d97-193a-4b0d-96f2-14fd868376de';

@Injectable()
export class LinearService {
  private linearClient: LinearClient | undefined;
  constructor(private readonly configService: ScratchpadConfigService) {
    // initialize the linear client
    if (configService.getLinearApiKey()) {
      this.linearClient = new LinearClient({
        apiKey: configService.getLinearApiKey(),
      });
    }
  }

  async createIssue(title: string, description: string): Promise<{ issueId: string; link: string | undefined }> {
    if (!this.linearClient) {
      throw new Error('Linear client not initialized');
    }

    // TODO: set to Triage status
    // Add Bug Report label

    const issue = await this.linearClient.createIssue({
      teamId: LINEAR_DEV_TEAM_ID,
      projectId: LINEAR_SCRATCH_PROJECT_ID,
      title,
      description,
      templateId: LINEAR_BUG_TEMPLATE_ID,
    });

    if (issue.success) {
      const createdIssue = await issue.issue;

      if (!createdIssue) {
        WSLogger.error({
          source: LinearService.name,
          message: `Failed to retrieve newly created issue from Linear for issue ID: ${issue.issueId}`,
        });
        return { issueId: issue.issueId ?? '', link: undefined };
      }

      return { issueId: createdIssue.id, link: createdIssue.url };
    } else {
      throw new Error(`Linear API failed to return a success response`);
    }
  }
}
