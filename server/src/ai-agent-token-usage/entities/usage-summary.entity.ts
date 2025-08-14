export interface UsageSummaryItem {
  model: string;
  totalTokens: number;
  totalRequests: number;
}

export class UsageSummary {
  totalTokens: number;
  items: UsageSummaryItem[];

  constructor(currentMonthUsage: { model: string; usage: { requests: number; totalTokens: number } }[]) {
    this.totalTokens = currentMonthUsage.reduce((acc, curr) => acc + curr.usage.totalTokens, 0);
    this.items = currentMonthUsage.map((item) => ({
      model: item.model,
      totalTokens: item.usage.totalTokens,
      totalRequests: item.usage.requests,
    }));
  }
}
