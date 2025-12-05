import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ScratchpadAuthGuard } from 'src/auth/scratchpad-auth.guard';
import type { RequestWithUser } from 'src/auth/types';
import { WSLogger } from 'src/logger';
import { OpenRouterService } from 'src/openrouter/openrouter.service';
import { isErr } from 'src/types/results';
import { userToActor } from '../users/types';
import { AgentCredentialsService } from './agent-credentials.service';
import { CreateAgentCredentialDto, ValidatedCreateAgentCredentialDto } from './dto/create-agent-credential.dto';
import { UpdateAgentCredentialDto } from './dto/update-agent-credential.dto';
import { AgentCredentialEntity, CreditUsageEntity } from './entities/credentials.entity';

@Controller('user/credentials')
@UseGuards(ScratchpadAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class AgentCredentialsController {
  constructor(
    private readonly service: AgentCredentialsService,
    private readonly openRouterService: OpenRouterService,
  ) {}

  @Get()
  async findAll(
    @Query('includeUsage') includeUsage: boolean = false,
    @Req() req: RequestWithUser,
  ): Promise<AgentCredentialEntity[]> {
    const creds = await this.service.findByUserId(req.user.id);
    const results: AgentCredentialEntity[] = [];
    if (creds && creds.length > 0) {
      if (includeUsage) {
        for (const cred of creds) {
          if (cred.service === 'openrouter' && cred.apiKey) {
            let usageData: CreditUsageEntity | undefined;
            const apiKeyData = await this.openRouterService.getCurrentApiKeyData(cred.apiKey);
            if (isErr(apiKeyData)) {
              WSLogger.error({
                source: AgentCredentialsController.name,
                message: `Failed to get data for ${cred.id}`,
                error: apiKeyData.error,
                cause: apiKeyData.cause,
              });
            } else {
              usageData = new CreditUsageEntity(apiKeyData.v);
            }

            results.push(new AgentCredentialEntity(cred, true, usageData));
          } else {
            results.push(new AgentCredentialEntity(cred));
          }
        }
      } else {
        results.push(...creds.map((s) => new AgentCredentialEntity(s)));
      }
    }

    return results;
  }

  @Get('active/:service')
  async findActive(@Param('service') service: string, @Req() req: RequestWithUser): Promise<AgentCredentialEntity> {
    const result = await this.service.findActiveServiceCredentials(userToActor(req.user), service);

    if (!result) {
      throw new NotFoundException();
    }

    // TODO - lock this endpoint down so only internal API keys can access it with the full api key in the response
    // only the Pydantic agent should be able to access this endpoint with the full api key in the response
    return new AgentCredentialEntity(result, true);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Query('includeUsage') includeUsage: boolean = false,
    @Req() req: RequestWithUser,
  ): Promise<AgentCredentialEntity | null> {
    const credential = await this.service.findOne(id);

    if (!credential) {
      return null;
    }

    if (credential.userId !== req.user.id) {
      throw new ForbiddenException('You are not authorized to access this agent credential');
    }

    // only include the api key if the request is authenticated with an agent token
    const includeApiKey = req.user.authType === 'agent-token';
    let usageData: CreditUsageEntity | undefined;
    if (includeUsage && credential.service === 'openrouter' && credential.apiKey) {
      const usageResult = await this.openRouterService.getCurrentApiKeyData(credential.apiKey);
      if (isErr(usageResult)) {
        WSLogger.error({
          source: AgentCredentialsController.name,
          message: `Failed to get data for ${credential.id}`,
          error: usageResult.error,
          cause: usageResult.cause,
        });
      } else {
        usageData = new CreditUsageEntity(usageResult.v);
      }
    }
    return new AgentCredentialEntity(credential, includeApiKey, usageData);
  }

  @Post('new')
  async create(
    @Body() createAgentCredentialDto: CreateAgentCredentialDto,
    @Req() req: RequestWithUser,
  ): Promise<AgentCredentialEntity> {
    const dto = createAgentCredentialDto as ValidatedCreateAgentCredentialDto;
    return new AgentCredentialEntity(await this.service.create(dto, userToActor(req.user)));
  }

  @Post(':id')
  async update(
    @Param('id') id: string,
    @Body() updateAgentCredentialDto: UpdateAgentCredentialDto,
    @Req() req: RequestWithUser,
  ): Promise<AgentCredentialEntity> {
    const dto = updateAgentCredentialDto;
    const credential = await this.service.findOne(id);
    const actor = userToActor(req.user);

    if (!credential) {
      throw new NotFoundException('Agent credential not found');
    }

    if (credential.userId !== actor.userId) {
      throw new ForbiddenException('You are not authorized to update this agent credential');
    }

    if (credential.source === 'SYSTEM' && dto.name) {
      // users cannot update the details of the system generated credentials, only the default flag
      throw new ForbiddenException('You are not authorized to update the name of a system generated credential');
    }

    // No values provided, throw error
    if (dto.default === undefined && dto.name === undefined && dto.tokenUsageWarningLimit === undefined) {
      throw new BadRequestException('At least one of name, tokenUsageWarningLimit, or default must be provided');
    }

    const updatedCredential = await this.service.update(id, actor, dto);

    if (!updatedCredential) {
      throw new NotFoundException('Failed to update agent credential');
    }

    return new AgentCredentialEntity(updatedCredential);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string, @Req() req: RequestWithUser): Promise<void> {
    const credential = await this.service.findOne(id);

    if (!credential) {
      throw new NotFoundException('Agent credential not found');
    }

    if (credential.userId !== req.user.id || credential.source === 'SYSTEM') {
      throw new ForbiddenException('You are not authorized to delete a system OpenRouter API key');
    }

    await this.service.delete(id, userToActor(req.user));
  }

  @Post(':id/set-default')
  async setDefaultKey(@Param('id') id: string, @Req() req: RequestWithUser): Promise<AgentCredentialEntity> {
    return new AgentCredentialEntity(await this.service.setDefaultKey(id, req.user.id));
  }
}
