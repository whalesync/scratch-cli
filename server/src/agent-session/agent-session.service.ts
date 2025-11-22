/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { ValidatedCreateAgentSessionDto } from './dto/create-agent-session.dto';
import { UpdateAgentSessionDto } from './dto/update-agent-session.dto';
import { AgentSessionEntity } from './entities/agent-session.entity';

@Injectable()
export class AgentSessionService {
  constructor(private db: DbService) {}

  async create(createAgentSessionDto: ValidatedCreateAgentSessionDto): Promise<AgentSessionEntity> {
    const agentSession = await this.db.client.agentSession.create({
      data: createAgentSessionDto,
    });

    return agentSession;
  }

  async findBySessionId(sessionId: string): Promise<AgentSessionEntity | null> {
    const agentSession = await this.db.client.agentSession.findUnique({
      where: { id: sessionId },
    });

    return agentSession;
  }

  async update(sessionId: string, updateAgentSessionDto: UpdateAgentSessionDto): Promise<AgentSessionEntity> {
    const agentSession = await this.db.client.agentSession.update({
      where: { id: sessionId },
      data: updateAgentSessionDto,
    });

    return agentSession;
  }

  async delete(sessionId: string): Promise<void> {
    await this.db.client.agentSession.delete({
      where: { id: sessionId },
    });
  }

  async upsert(sessionId: string, data: any): Promise<AgentSessionEntity> {
    const agentSession = await this.db.client.agentSession.upsert({
      where: { id: sessionId },
      update: { data },
      create: {
        id: sessionId,
        userId: data.user_id,
        workbookId: data.workbook_id,
        data,
      },
    });

    return agentSession;
  }

  async findByUserId(userId: string): Promise<AgentSessionEntity[]> {
    const agentSessions = await this.db.client.agentSession.findMany({
      where: {
        userId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return agentSessions;
  }

  async findByWorkbookId(workbookId: string): Promise<AgentSessionEntity[]> {
    const agentSessions = await this.db.client.agentSession.findMany({
      where: {
        workbookId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return agentSessions;
  }
}
