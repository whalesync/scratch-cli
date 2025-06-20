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

  private getEnvVariable<T>(envVariable: string): T {
    const returnedVar: T | undefined = this.configService.get<T>(envVariable);
    if (returnedVar === undefined) {
      throw new Error(
        `${envVariable} is not defined. Please add this variable to the Docker file.`,
      );
    }
    return returnedVar;
  }
}
