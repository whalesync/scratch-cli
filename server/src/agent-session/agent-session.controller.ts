import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import { AgentSessionService } from './agent-session.service';
import { CreateAgentSessionDto, ValidatedCreateAgentSessionDto } from './dto/create-agent-session.dto';
import { UpdateAgentSessionDto } from './dto/update-agent-session.dto';
import { AgentSessionEntity } from './entities/agent-session.entity';

@Controller('agent-sessions')
@UseGuards(ScratchpadAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class AgentSessionController {
  constructor(private readonly agentSessionService: AgentSessionService) {}

  @Post()
  async create(@Body() createAgentSessionDto: CreateAgentSessionDto): Promise<AgentSessionEntity> {
    const dto = createAgentSessionDto as ValidatedCreateAgentSessionDto;
    return this.agentSessionService.create(dto);
  }

  @Get(':sessionId')
  async findBySessionId(@Param('sessionId') sessionId: string): Promise<AgentSessionEntity | null> {
    return this.agentSessionService.findBySessionId(sessionId);
  }

  @Put(':sessionId')
  async update(
    @Param('sessionId') sessionId: string,
    @Body() updateAgentSessionDto: UpdateAgentSessionDto,
  ): Promise<AgentSessionEntity> {
    const dto = updateAgentSessionDto;
    return this.agentSessionService.update(sessionId, dto);
  }

  @Delete(':sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('sessionId') sessionId: string): Promise<void> {
    return this.agentSessionService.delete(sessionId);
  }

  @Post(':sessionId/upsert')
  async upsert(@Param('sessionId') sessionId: string, @Body() body: { data: any }): Promise<AgentSessionEntity> {
    return this.agentSessionService.upsert(sessionId, body.data);
  }

  @Get('user/:userId')
  async findByUserId(@Param('userId') userId: string): Promise<AgentSessionEntity[]> {
    return this.agentSessionService.findByUserId(userId);
  }

  @Get('workbook/:workbookId')
  async findByWorkbookId(@Param('workbookId') workbookId: string): Promise<AgentSessionEntity[]> {
    return this.agentSessionService.findByWorkbookId(workbookId);
  }
}
