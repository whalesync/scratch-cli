import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { createAiAgentTokenUsageEventId } from '../types/ids';
import { CreateAiAgentTokenUsageEventDto } from './dto/create-ai-agent-token-usage-event.dto';
import { AiAgentTokenUsageEvent } from './entities/ai-agent-token-usage-event.entity';

@Injectable()
export class AiAgentTokenUsageService {
  constructor(private readonly db: DbService) {}

  async create(
    createAiAgentTokenUsageEventDto: CreateAiAgentTokenUsageEventDto,
    userId: string,
  ): Promise<AiAgentTokenUsageEvent> {
    const aiAgentTokenUsageEvent = await this.db.client.aiAgentTokenUsageEvent.create({
      data: {
        id: createAiAgentTokenUsageEventId(),
        ...createAiAgentTokenUsageEventDto,
        userId,
      },
    });

    return new AiAgentTokenUsageEvent(aiAgentTokenUsageEvent);
  }

  async findAll(userId: string, take?: number, cursor?: string): Promise<AiAgentTokenUsageEvent[]> {
    const aiAgentTokenUsageEvents = await this.db.client.aiAgentTokenUsageEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
      skip: cursor ? 1 : undefined,
    });

    return aiAgentTokenUsageEvents.map((event) => new AiAgentTokenUsageEvent(event));
  }
}
