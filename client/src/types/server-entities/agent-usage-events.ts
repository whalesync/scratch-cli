export interface AgentUsageEvent {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    model: string;
    requests: number;
    requestTokens: number;
    responseTokens: number;
    totalTokens: number;
    context?: Record<string, string>;
  }

  export interface UsageSummary {
    totalTokens: number;
    items: UsageSummaryItem[];
  }

  export interface UsageSummaryItem {
    model: string;
    totalTokens: number;
    totalRequests: number;
  }