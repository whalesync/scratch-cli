import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LogLevel, WSLogger } from 'src/logger';
import { stringToEnum } from 'src/utils/helpers';

/** This should basically never be used. */
export type NodeEnvironment = 'development' | 'test' | 'staging' | 'production';

/** This should be used for checking the deployment flavor. */
export type ScratchpadEnvironment = 'development' | 'test' | 'staging' | 'production';

@Injectable()
export class ScratchpadConfigService {
  private readonly databaseUrl: string;
  private readonly environment: ScratchpadEnvironment;

  constructor(private readonly configService: ConfigService) {
    this.databaseUrl = this.getEnvVariable('DATABASE_URL');
    this.environment = ScratchpadConfigService.getScratchpadEnvironment();

    if (process.env.LOG_LEVEL) {
      WSLogger.info({
        source: 'ScratchpadConfigService',
        message: 'Setting log level',
        logLevel: process.env.LOG_LEVEL,
      });
      WSLogger.setOutputLevel(stringToEnum(process.env.LOG_LEVEL, LogLevel, LogLevel.INFO));
    }
  }

  getScratchpadEnvironment(): ScratchpadEnvironment {
    return this.environment;
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

  getStripeApiKey(): string {
    return this.getEnvVariable('STRIPE_API_KEY');
  }

  getStripeWebhookSecret(): string {
    return this.getEnvVariable('STRIPE_WEBHOOK_SECRET');
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

  public static getScratchpadEnvironment(): ScratchpadEnvironment {
    return checkIsString(process.env.APP_ENV, 'APP_ENV', [
      'development',
      'test',
      'staging',
      'production',
      'automated_test',
    ]) as ScratchpadEnvironment;
  }

  public static getClientBaseUrl(): string {
    const env = ScratchpadConfigService.getScratchpadEnvironment();
    if (env === 'production') {
      return 'https://scratchpad.whalesync.com';
    }
    if (env === 'development') {
      return `http://localhost:3000`;
    }
    // Otherwise, test or staging
    return `https://${env}-scratchpad.whalesync.com`;
  }
}

function checkIsString(value: string | undefined, varName: string, restrictToOptions?: string[]): string {
  if (value === undefined || value.length === 0) {
    throw new Error(`env var ${varName} must be set, but was empty`);
  }
  if (restrictToOptions !== undefined && !restrictToOptions.includes(value)) {
    throw new Error(`env var ${varName} must be one of: ${restrictToOptions.join(', ')}, but it was ${value}`);
  }
  return value;
}
