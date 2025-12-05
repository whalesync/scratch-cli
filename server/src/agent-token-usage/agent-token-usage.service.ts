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
    monthISOString?: string,
  ): Promise<AgentTokenUsageEventEntity[]> {
    const month = monthISOString ? new Date(monthISOString) : undefined;
    const startOfMonth = month ? new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1)) : undefined;
    const endOfMonth = month ? new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)) : undefined;

    const aiAgentTokenUsageEvents = await this.db.client.aiAgentTokenUsageEvent.findMany({
      where: { userId, credentialId, createdAt: month ? { gte: startOfMonth, lt: endOfMonth } : undefined },
      orderBy: { createdAt: 'desc' },
      take,
      skip: cursor ? 1 : undefined,
    });

    return aiAgentTokenUsageEvents.map((event) => new AgentTokenUsageEventEntity(event));
  }

  async getUsageSummary(userId: string, credentialId?: string, monthISOString?: string): Promise<UsageSummaryEntity> {
    const month = monthISOString ? new Date(monthISOString) : new Date();
    const startOfMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
    const endOfMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));

    const usageByModel = await this.db.client.aiAgentTokenUsageEvent.groupBy({
      by: ['model'],
      where: {
        userId,
        credentialId,
        createdAt: {
          gte: startOfMonth,
          lt: endOfMonth,
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
    const usage = usageByModel.map((item) => ({
      model: item.model,
      usage: {
        requests: item._sum.requests ?? 0,
        totalTokens: item._sum.totalTokens ?? 0,
      },
    }));

    return new UsageSummaryEntity(usage);
  }
}
