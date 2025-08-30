import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ScratchpadConfigService {
  private readonly databaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.databaseUrl = this.getEnvVariable('DATABASE_URL');
  }

  getDatabaseUrl(): string {
    return this.databaseUrl;
  }

  getClerkSecretKey(): string {
    return this.getEnvVariable('CLERK_SECRET_KEY');
  }

  getClerkPublishableKey(): string {
    return this.getEnvVariable('CLERK_PUBLISHABLE_KEY');
  }

  /**
   * @returns The Gemini API key. If not set, the local GCP credentials will be used.
   */
  getGeminiApiKey(): string | undefined {
    return this.configService.get<string>('GEMINI_API_KEY');
  }

  getDbDebug(): boolean {
    return this.configService.get<string>('DB_DEBUG') === 'true';
  }

  /**
   * @returns The Scratchpad Agent Auth token. Used for special bearer token auth for the agent to make API calls
   */
  getScratchpadAgentAuthToken(): string {
    return this.getEnvVariable('SCRATCHPAD_AGENT_AUTH_TOKEN');
  }

  /**
   * @returns The Scratchpad Agent JWT secret. Used to sign expiring JWT tokens allowing the client to make API calls to the agent.
   */
  getScratchpadAgentJWTSecret(): string {
    return this.getEnvVariable('SCRATCHPAD_AGENT_JWT_SECRET');
  }

  /**
   * @returns The Scratchpad Agent JWT expires in. Used to set the expiration time for the generated tokens.
   */
  getScratchpadAgentJWTExpiresIn(): string {
    return this.getEnvVariable('SCRATCHPAD_AGENT_JWT_EXPIRES_IN');
  }

  getPostHogApiKey(): string | undefined {
    return this.getOptionalEnvVariable('POSTHOG_API_KEY');
  }

  getPostHogHost(): string | undefined {
    return this.getOptionalEnvVariable('POSTHOG_HOST');
  }

  private getEnvVariable<T>(envVariable: string): T {
    const returnedVar: T | undefined = this.configService.get<T>(envVariable);
    if (returnedVar === undefined) {
      throw new Error(`${envVariable} is not defined. Please add this variable to your environment.`);
    }
    return returnedVar;
  }

  private getOptionalEnvVariable<T>(envVariable: string): T | undefined {
    const returnedVar: T | undefined = this.configService.get<T>(envVariable);
    return returnedVar ?? undefined;
  }
}
