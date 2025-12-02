import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StringValue } from 'ms';
import { LogLevel, WSLogger } from 'src/logger';
import { stringToEnum } from 'src/utils/helpers';

/** This should basically never be used. */
export type NodeEnvironment = 'development' | 'test' | 'staging' | 'production';

/** This should be used for checking the deployment flavor. */
export type ScratchpadEnvironment = 'development' | 'test' | 'staging' | 'production';

/**
 * The current type of this microservice. This same binary is used to run multiple kinds of microservices, and the
 * behavior of each microservice is different.
 */
export enum MicroserviceType {
  FRONTEND = 'api',
  // Just runs worker tasks for bull MQ
  WORKER = 'worker',
  // Runs cron tasks
  CRON = 'cron',
  // ONLY used for local development. This is essentially *all* microservice types in one.
  MONOLITH = 'monolith',
}

@Injectable()
export class ScratchpadConfigService {
  private readonly databaseUrl: string;
  private readonly environment: ScratchpadEnvironment;
  private readonly serviceType: MicroserviceType;
  private readonly runningInCloudRun: boolean;

  constructor(private readonly configService: ConfigService) {
    this.databaseUrl = this.getEnvVariable('DATABASE_URL');
    this.runningInCloudRun = this.getOptionalFlagVariable('RUNNING_IN_CLOUD', false);
    this.environment = ScratchpadConfigService.getScratchpadEnvironment();
    this.serviceType = ScratchpadConfigService.getScratchpadServiceType();

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

  isProductionEnvironment(): boolean {
    return this.environment === 'production';
  }

  getServiceType(): MicroserviceType {
    return this.serviceType;
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
    return this.getOptionalFlagVariable('DB_DEBUG', false);
  }

  /**
   * @returns The Scratch Agent Auth token. Used for special bearer token auth for the agent to make API calls
   */
  getScratchpadAgentAuthToken(): string {
    return this.getEnvVariable('SCRATCHPAD_AGENT_AUTH_TOKEN');
  }

  /**
   * @returns The Scratch Agent JWT secret. Used to sign expiring JWT tokens allowing the client to make API calls to the agent.
   */
  getScratchpadAgentJWTSecret(): string {
    return this.getEnvVariable('SCRATCHPAD_AGENT_JWT_SECRET');
  }

  /**
   * @returns The Scratch Agent JWT expires in. Used to set the expiration time for the generated tokens.
   */
  getScratchpadAgentJWTExpiresIn(): StringValue {
    const expiresIn = this.getEnvVariable<string>('SCRATCHPAD_AGENT_JWT_EXPIRES_IN');

    // Validate that expiresIn matches the StringValue format (e.g., "2h", "30m", "7d", "100")
    // Pattern: optional number, optional space, optional time unit (case insensitive)
    // Take a look at ms.StringValue.
    const stringValuePattern =
      /^\d+(\s?(?:years?|yrs?|y|weeks?|w|days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s|milliseconds?|msecs?|ms))?$/i;

    if (!stringValuePattern.test(expiresIn)) {
      throw new Error(
        `SCRATCHPAD_AGENT_JWT_EXPIRES_IN must be a valid time string (e.g., "2h", "30m", "7d", "100"), but got: ${expiresIn}`,
      );
    }

    return expiresIn as StringValue;
  }

  isPosthogAnaltyicsEnabled(): boolean {
    // default to true for deployed environments
    return this.getOptionalFlagVariable('POSTHOG_ANALYTICS_ENABLED', this.getScratchpadEnvironment() !== 'development');
  }

  getPostHogApiKey(): string | undefined {
    return this.getOptionalEnvVariable('POSTHOG_API_KEY');
  }

  getPostHogHost(): string | undefined {
    return this.getOptionalEnvVariable('POSTHOG_HOST');
  }

  getPosthogFeatureFlagApiKey(): string | undefined {
    return this.getOptionalEnvVariable('POSTHOG_FEATURE_FLAG_API_KEY');
  }

  getStripeApiKey(): string {
    return this.getEnvVariable('STRIPE_API_KEY');
  }

  getStripeWebhookSecret(): string {
    return this.getEnvVariable('STRIPE_WEBHOOK_SECRET');
  }

  getGenerateOpenRouterKeyForNewUsers(): boolean {
    return this.getOptionalFlagVariable('GENERATE_OPENROUTER_KEY_FOR_NEW_USERS', false);
  }

  getOpenRouterProvisioningKey(): string | undefined {
    return this.getOptionalEnvVariable('OPENROUTER_PROVISIONING_KEY');
  }

  getNewUserOpenRouterCreditLimit(): number {
    return this.getOptionalNumberVariable('NEW_USER_OPENROUTER_CREDIT_LIMIT', 10);
  }

  getSlackNotificationWebhookUrl(): string | undefined {
    return this.getOptionalEnvVariable('SLACK_NOTIFICATION_WEBHOOK_URL');
  }

  isSlackNotificationEnabled(): boolean {
    return this.getOptionalFlagVariable('SLACK_NOTIFICATION_ENABLED', false);
  }

  getRedisHost(): string {
    return this.getOptionalEnvVariable<string>('REDIS_HOST') ?? 'localhost';
  }

  getRedisPort(): number {
    return this.getOptionalNumberVariable('REDIS_PORT', 6379);
  }

  getRedisPassword(): string | undefined {
    return this.getOptionalEnvVariable<string>('REDIS_PASSWORD');
  }

  getUseJobs(): boolean {
    return this.getOptionalFlagVariable('USE_JOBS', false);
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

  private getOptionalNumberVariable(envVariable: string, defaultValue: number): number {
    const returnedVar: string | undefined = this.configService.get<string>(envVariable);
    if (returnedVar === undefined) {
      return defaultValue;
    }
    return parseFloat(returnedVar);
  }

  private getOptionalFlagVariable(envVariable: string, defaultValue: boolean): boolean {
    const returnedVar: string | undefined = this.configService.get<string>(envVariable);
    if (returnedVar === undefined) {
      return defaultValue;
    }
    return returnedVar.toLowerCase() === 'true';
  }

  /*
   * STATIC METHODS
   */

  public static getScratchpadEnvironment(): ScratchpadEnvironment {
    return checkIsString(process.env.APP_ENV, 'APP_ENV', [
      'development',
      'test',
      'staging',
      'production',
      'automated_test',
    ]) as ScratchpadEnvironment;
  }

  public static isRunningInCloudRun(): boolean {
    return process.env.RUNNING_IN_CLOUD === 'true';
  }

  public static getClientBaseUrl(): string {
    const env = ScratchpadConfigService.getScratchpadEnvironment();
    if (env === 'development') {
      return `http://localhost:3000`;
    }

    if (env === 'production') {
      // Need to check this because we have two different production environments until we fully migrate to the new domain.
      return ScratchpadConfigService.isRunningInCloudRun() ? 'https://app.scratch.md' : 'https://app.scratchpaper.ai';
    }

    // Otherwise, test or staging
    return `https://${env}.scratch.md`;
  }

  public static getScratchpadServiceType(): MicroserviceType {
    return checkIsString(process.env.SERVICE_TYPE, 'SERVICE_TYPE', [
      MicroserviceType.FRONTEND,
      MicroserviceType.WORKER,
      MicroserviceType.CRON,
      MicroserviceType.MONOLITH,
    ]) as MicroserviceType;
  }

  public static isFrontendAPIService(): boolean {
    const type = process.env.SERVICE_TYPE;
    return type === MicroserviceType.FRONTEND || type === MicroserviceType.MONOLITH;
  }

  public static isTaskWorkerService(): boolean {
    const type = process.env.SERVICE_TYPE;
    return type === MicroserviceType.WORKER || type === MicroserviceType.MONOLITH;
  }

  public static isCronService(): boolean {
    const type = process.env.SERVICE_TYPE;
    return type === MicroserviceType.CRON || type === MicroserviceType.MONOLITH;
  }

  public static isMonolithService(): boolean {
    const type = process.env.SERVICE_TYPE;
    return type === MicroserviceType.MONOLITH;
  }
}

/*
 * UTILITY FUNCTIONS
 */

function checkIsString(value: string | undefined, varName: string, restrictToOptions?: string[]): string {
  if (value === undefined || value.length === 0) {
    throw new Error(`env var ${varName} must be set, but was empty`);
  }
  if (restrictToOptions !== undefined && !restrictToOptions.includes(value)) {
    throw new Error(`env var ${varName} must be one of: ${restrictToOptions.join(', ')}, but it was ${value}`);
  }
  return value;
}
