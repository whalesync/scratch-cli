import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { createAiAgentTokenUsageEventId } from '../types/ids';
import { ValidatedCreateAiAgentTokenUsageEventDto } from './dto/create-ai-agent-token-usage-event.dto';
import { AiAgentTokenUsageEvent } from './entities/ai-agent-token-usage-event.entity';
import { UsageSummary } from './entities/usage-summary.entity';

@Injectable()
export class AiAgentTokenUsageService {
  constructor(private readonly db: DbService) {}

  async create(
    createAiAgentTokenUsageEventDto: ValidatedCreateAiAgentTokenUsageEventDto,
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

  async getUsageSummary(userId: string): Promise<UsageSummary> {
    const currentMonthUsage = await this.db.client.aiAgentTokenUsageEvent.groupBy({
      by: ['model'],
      where: {
        userId,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1), // First day of current month
          lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1), // First day of next month
        },
      },
      _sum: {
        requests: true,
        totalTokens: true,
      },
      orderBy: {
        model: 'asc',
      },
    });

    // cleanup the data and add default values
    const usage = currentMonthUsage.map((item) => ({
      model: item.model,
      usage: {
        requests: item._sum.requests ?? 0,
        totalTokens: item._sum.totalTokens ?? 0,
      },
    }));

    return new UsageSummary(usage);
  }
}
