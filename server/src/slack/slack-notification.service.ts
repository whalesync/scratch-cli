import { Injectable } from '@nestjs/common';
import axios from 'axios';

import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { WSLogger } from 'src/logger';
import { AsyncVoidResult, ErrorCode, errResult, ok } from 'src/types/results';

/*
 * Service for sending notifications to the developer slack channel
 *
 * Future Upgrade: a function that allows sending messages as a list of blocks
 * using the Slack Block Kit: https://api.slack.com/reference/block-kit/blocks
 */
@Injectable()
export class SlackNotificationService {
  private readonly webhookUrl: string | undefined;
  constructor(private readonly scratchpadConfigService: ScratchpadConfigService) {
    this.webhookUrl = this.scratchpadConfigService.getSlackNotificationWebhookUrl();
  }

  /*
   * Send a notification message to the Slack channel for this environment
   * @param message The message to send in mkdn format: https://api.slack.com/reference/surfaces/formatting#basics
   * @return The associated User object if it could be found
   */
  async sendMessage(message: string): AsyncVoidResult {
    if (!this.scratchpadConfigService.isSlackNotificationEnabled() || !this.webhookUrl) {
      return ok();
    }

    // Slack message JSON object (simple format)
    const messageData = {
      text: message,
    };

    try {
      const responseData = await axios.post(this.webhookUrl, messageData, {
        timeout: 2000,
        headers: {
          'User-Agent': 'Scratchpaper/1.0 (compatible; ScratchpaperSlackNotification/1.0)',
        },
      });

      if (responseData.status === 200 || responseData.status === 201 || responseData.status === 202) {
        return ok();
      }

      WSLogger.error({
        source: 'SlackNotificationService',
        message: 'Failed to send slack message',
        cause: responseData.statusText,
      });

      return errResult(
        ErrorCode.BadRequestError,
        `Failed to send slack message: ${responseData.status} - ${responseData.statusText}`,
      );
    } catch (err) {
      WSLogger.error({
        source: 'SlackNotificationService',
        message: 'Failed to send slack message',
        cause: err as Error,
      });
      return errResult(ErrorCode.UnexpectedError, 'Failed to send slack message', { cause: err as Error });
    }
  }
}
