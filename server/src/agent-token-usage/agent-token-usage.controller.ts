import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CreateAgentTokenUsageEventDto, ValidatedCreateAgentTokenUsageEventDto } from '@spinner/shared-types';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import type { RequestWithUser } from '../auth/types';
import { AgentTokenUsageService } from './agent-token-usage.service';

@Controller('agent-token-usage')
@UseGuards(ScratchpadAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class AgentTokenUsageController {
  constructor(private readonly agentTokenUsageService: AgentTokenUsageService) {}

  @Post('/track')
  create(@Body() usageEventDto: CreateAgentTokenUsageEventDto, @Req() req: RequestWithUser) {
    const dto = usageEventDto as ValidatedCreateAgentTokenUsageEventDto;
    return this.agentTokenUsageService.create(dto, req.user.id);
  }

  @Get('/events')
  findAll(
    @Req() req: RequestWithUser,
    @Query('take') take?: string,
    @Query('cursor') cursor?: string,
    @Query('credentialId') credentialId?: string,
    @Query('month') monthIsoString?: string,
  ) {
    return this.agentTokenUsageService.findAll(
      req.user.id,
      take ? parseInt(take) : undefined,
      cursor,
      credentialId,
      monthIsoString,
    );
  }

  @Get('/stats/summary')
  getSummary(
    @Req() req: RequestWithUser,
    @Query('credentialId') credentialId?: string,
    @Query('month') monthIsoString?: string,
  ) {
    return this.agentTokenUsageService.getUsageSummary(req.user.id, credentialId, monthIsoString);
  }
}
