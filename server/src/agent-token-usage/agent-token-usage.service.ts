import { Injectable } from '@nestjs/common';
import { createAiAgentTokenUsageEventId } from '@spinner/shared-types';
import { DbService } from '../db/db.service';
import { ValidatedCreateAgentTokenUsageEventDto } from './dto/create-agent-token-usage-event.dto';
import { AgentTokenUsageEventEntity } from './entities/agent-token-usage-event.entity';
import { UsageSummaryEntity } from './entities/usage-summary.entity';

@Injectable()
export class AgentTokenUsageService {
  constructor(private readonly db: DbService) {}

  async create(dto: ValidatedCreateAgentTokenUsageEventDto, userId: string): Promise<AgentTokenUsageEventEntity> {
    const aiAgentTokenUsageEvent = await this.db.client.aiAgentTokenUsageEvent.create({
      data: {
        id: createAiAgentTokenUsageEventId(),
        ...dto,
        userId,
      },
    });

    return new AgentTokenUsageEventEntity(aiAgentTokenUsageEvent);
  }

  async findAll(
    userId: string,
    take?: number,
    cursor?: string,
    credentialId?: string,
  ): Promise<AgentTokenUsageEventEntity[]> {
    const aiAgentTokenUsageEvents = await this.db.client.aiAgentTokenUsageEvent.findMany({
      where: { userId, credentialId },
      orderBy: { createdAt: 'desc' },
      take,
      skip: cursor ? 1 : undefined,
    });

    return aiAgentTokenUsageEvents.map((event) => new AgentTokenUsageEventEntity(event));
  }

  async getUsageSummary(userId: string): Promise<UsageSummaryEntity> {
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

    return new UsageSummaryEntity(usage);
  }
}
