import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { AsyncResult, badRequestError, generalError, ok } from 'src/types/results';
import {
  OpenRouterCreateKeyResponse,
  OpenRouterDeleteKeyResponse,
  OpenRouterGetCurrentApiKeyData,
  OpenRouterGetCurrentApiKeyResponse,
  OpenRouterModel,
  OpenRouterModelsResponse,
  OpenRouterUpdateApiKeyResponse,
  OpenRouterUpdateRequest,
} from './types';

/*
 * Service for managing OpenRouter API keys using the provisioning API.
 */
@Injectable()
export class OpenRouterService {
  private readonly openRouterApiUrl = 'https://openrouter.ai/api/v1';
  private readonly httpReferer = 'https://app.scratch.md';
  private readonly httpXTitle = 'Scratch.md';

  constructor(private readonly configService: ScratchpadConfigService) {}

  /**
   Key Management API
   https://openrouter.ai/docs/api-reference/keys
   @param args.userId - The user ID for the API key
   @param args.limit - The credit limit for the API key
   @param args.limitReset - The limit reset period for the API key. `never` means no reset
   @returns The new API key and hash. Both are required to perform additional key management operations.
   */
  async createKey(args: {
    userId: string;
    limit?: number;
    limitReset?: 'daily' | 'weekly' | 'monthly' | 'never';
  }): AsyncResult<{ key: string; hash: string }> {
    const { userId, limit, limitReset } = args;
    const provisioningKey = this.configService.getOpenRouterProvisioningKey();
    if (!provisioningKey) {
      return generalError('OpenRouter provisioning key is not set');
    }

    const scratchpadEnvironment = this.configService.getScratchpadEnvironment();

    /**
     * NOTE: Generated api keys will get flagged as free tier if the there are no credits allocated to the organization that owns the Provisioning Key
     */
    const payload = {
      name: `User ${userId} System Key${scratchpadEnvironment !== 'production' ? ` (${scratchpadEnvironment})` : ''}`,
      limit: limit ?? this.configService.getNewUserOpenRouterCreditLimit(),
      limit_reset: !limitReset || limitReset === 'never' ? undefined : limitReset,
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

  async updateApiKey(hash: string, dto: OpenRouterUpdateRequest): AsyncResult<void> {
    const provisioningKey = this.configService.getOpenRouterProvisioningKey();
    if (!provisioningKey) {
      return generalError('OpenRouter provisioning key is not set');
    }
    try {
      const response = await axios.patch(`${this.openRouterApiUrl}/keys/${hash}`, dto, {
        headers: {
          Authorization: `Bearer ${provisioningKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': this.httpReferer,
          'X-Title': this.httpXTitle,
        },
      });
      const responseData = response.data as OpenRouterUpdateApiKeyResponse;
      if (!responseData.data) {
        return generalError('Failed to update OpenRouter key, no data returned');
      }
      return ok();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = (error.response?.data as { message?: string })?.message || error.message;
        return generalError(`Failed to update OpenRouter key: ${errorMessage}`);
      }
      return generalError(`Failed to update OpenRouter key: ${String(error)}`);
    }
  }

  async disableApiKey(hash: string): AsyncResult<void> {
    const provisioningKey = this.configService.getOpenRouterProvisioningKey();
    if (!provisioningKey) {
      return generalError('OpenRouter provisioning key is not set');
    }
    return this.updateApiKey(hash, { disabled: true });
  }

  async enableApiKey(hash: string): AsyncResult<void> {
    const provisioningKey = this.configService.getOpenRouterProvisioningKey();
    if (!provisioningKey) {
      return generalError('OpenRouter provisioning key is not set');
    }
    return this.updateApiKey(hash, { disabled: false });
  }

  async updateApiKeyCreditLimit(hash: string, limit: number): AsyncResult<void> {
    const provisioningKey = this.configService.getOpenRouterProvisioningKey();
    if (!provisioningKey) {
      return generalError('OpenRouter provisioning key is not set');
    }

    if (limit <= 0) {
      return badRequestError('Credit limit must be greater than 0');
    }

    return this.updateApiKey(hash, { limit });
  }

  /**
   * https://openrouter.ai/docs/api-reference/api-keys/delete-api-key
   * @param hash - The hash of the API key to delete
   */
  async deleteApiKey(apiKey: string, hash: string): AsyncResult<void> {
    try {
      const response = await axios.delete(`${this.openRouterApiUrl}/keys/${hash}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': this.httpReferer,
          'X-Title': this.httpXTitle,
        },
      });
      const responseData = response.data as OpenRouterDeleteKeyResponse;
      if (!responseData.data.success) {
        return generalError('Failed to delete OpenRouter key');
      }
      return ok();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = (error.response?.data as { message?: string })?.message || error.message;
        return generalError(`Failed to delete OpenRouter key: ${errorMessage}`);
      }
      return generalError(`Failed to delete OpenRouter key: ${String(error)}`);
    }
  }

  /*
   Get the current API key data including rate limits and credit usage
   https://openrouter.ai/docs/api-reference/api-keys/get-current-api-key
   */
  async getCurrentApiKeyData(apiKey: string): AsyncResult<OpenRouterGetCurrentApiKeyData> {
    try {
      const response = await axios.get(`${this.openRouterApiUrl}/key`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': this.httpReferer,
          'X-Title': this.httpXTitle,
        },
      });
      const responseData = response.data as OpenRouterGetCurrentApiKeyResponse;
      return ok(responseData.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = (error.response?.data as { message?: string })?.message || error.message;
        return generalError(`Failed to get OpenRouter current API key data: ${errorMessage}`);
      }
      return generalError(`Failed to get OpenRouter current API key data: ${String(error)}`);
    }
  }

  /**
   * Get all available models with their pricing information
   * https://openrouter.ai/docs/api-reference/models
   * @returns List of models with pricing data
   */
  async getModels(): AsyncResult<OpenRouterModel[]> {
    try {
      const response = await axios.get(`${this.openRouterApiUrl}/models`, {
        headers: {
          'Content-Type': 'application/json',
          'HTTP-Referer': this.httpReferer,
          'X-Title': this.httpXTitle,
        },
      });
      const responseData = response.data as OpenRouterModelsResponse;
      return ok(responseData.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = (error.response?.data as { message?: string })?.message || error.message;
        return generalError(`Failed to fetch OpenRouter models: ${errorMessage}`);
      }
      return generalError(`Failed to fetch OpenRouter models: ${String(error)}`);
    }
  }
}
