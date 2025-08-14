import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import { RequestWithUser } from '../auth/types';
import { AiAgentTokenUsageService } from './ai-agent-token-usage.service';
import { CreateAiAgentTokenUsageEventDto } from './dto/create-ai-agent-token-usage-event.dto';

@Controller('agent-token-usage')
@UseGuards(ScratchpadAuthGuard)
export class AiAgentTokenUsageController {
  constructor(private readonly aiAgentTokenUsageService: AiAgentTokenUsageService) {}

  @Post('/track')
  create(@Body() createAiAgentTokenUsageEventDto: CreateAiAgentTokenUsageEventDto, @Req() req: RequestWithUser) {
    return this.aiAgentTokenUsageService.create(createAiAgentTokenUsageEventDto, req.user.id);
  }

  @Get('/events')
  findAll(@Req() req: RequestWithUser, @Query('take') take?: string, @Query('cursor') cursor?: string) {
    return this.aiAgentTokenUsageService.findAll(req.user.id, take ? parseInt(take) : undefined, cursor);
  }

  @Get('/stats/summary')
  getSummary(@Req() req: RequestWithUser) {
    return this.aiAgentTokenUsageService.getUsageSummary(req.user.id);
  }
}
