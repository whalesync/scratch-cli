import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { AsyncResult, generalError, ok } from 'src/types/results';
import { OpenRouterCreateKeyResponse, OpenRouterGetCreditsResponse } from './types';

/*
 * Service for managing OpenRouter API keys using the provisioning API.
 */
@Injectable()
export class OpenRouterService {
  private readonly openRouterApiUrl = 'https://openrouter.ai/api/v1';
  private readonly httpReferer = 'https://scratchpaper.ai';
  private readonly httpXTitle = 'Scratchpaper.ai';

  constructor(private readonly configService: ScratchpadConfigService) {}

  async createKey(userId: string): AsyncResult<{ key: string; hash: string }> {
    const provisioningKey = this.configService.getOpenRouterProvisioningKey();
    if (!provisioningKey) {
      return generalError('OpenRouter provisioning key is not set');
    }

    const payload = {
      name: `User ${userId} Starter Key`,
      limit: this.configService.getNewUserOpenRouterCreditLimit(),
      include_byok_in_limit: true,
    };

    try {
      const response = await axios.post(`${this.openRouterApiUrl}/keys`, payload, {
        headers: {
          Authorization: `Bearer ${provisioningKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': this.httpReferer,
          'X-Title': this.httpXTitle,
        },
      });

      // The response should contain the new API key
      const responseData = response.data as OpenRouterCreateKeyResponse;
      const newOpenRouterKey = responseData.key;
      const newOpenRouterKeyHash = responseData.data.hash;
      if (!newOpenRouterKey) {
        return generalError('Failed to extract API key from OpenRouter response');
      }
      if (!newOpenRouterKeyHash) {
        return generalError('Failed to extract API key hash from OpenRouter response');
      }

      return ok({ key: newOpenRouterKey, hash: newOpenRouterKeyHash });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = (error.response?.data as { message?: string })?.message || error.message;
        return generalError(`Failed to create OpenRouter key: ${errorMessage}`);
      }
      return generalError(`Failed to create OpenRouter key: ${String(error)}`);
    }
  }

  async getCredits(apiKey: string): AsyncResult<{ totalCredits: number; totalUsage: number }> {
    try {
      const response = await axios.get(`${this.openRouterApiUrl}/credits`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      const responseData = response.data as OpenRouterGetCreditsResponse;
      return ok({ totalCredits: responseData.data.total_credits, totalUsage: responseData.data.total_usage });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = (error.response?.data as { message?: string })?.message || error.message;
        return generalError(`Failed to get OpenRouter credits: ${errorMessage}`);
      }
      return generalError(`Failed to get OpenRouter credits: ${String(error)}`);
    }
  }

  //   async disableKey(hash: string): AsyncResult<void> {
  //     const provisioningKey = this.configService.getOpenRouterProvisioningKey();
  //     if (!provisioningKey) {
  //       return generalError('OpenRouter provisioning key is not set');
  //     }
  //   }

  //   async enableKey(hash: string): AsyncResult<void> {
  //     const provisioningKey = this.configService.getOpenRouterProvisioningKey();
  //     if (!provisioningKey) {
  //       return generalError('OpenRouter provisioning key is not set');
  //     }
  //   }
  //   async deleteKey(hash: string): AsyncResult<void> {
  //     const provisioningKey = this.configService.getOpenRouterProvisioningKey();
  //     if (!provisioningKey) {
  //       return generalError('OpenRouter provisioning key is not set');
  //     }
  //   }
}
