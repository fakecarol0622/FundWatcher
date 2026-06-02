export interface Holding {
  fundCode: string;
  shares: number;
  costNav: number;
  note?: string;
  updatedAt: number;
}

export interface HoldingComputed {
  fundCode: string;
  fundName: string;
  shares: number;
  costNav: number;
  currentEstimatedNav: number | null;
  latestNav: number | null;
  costAmount: number;
  estimatedMarketValue: number | null;
  estimatedProfit: number | null;
  estimatedProfitPercent: number | null;
  todayProfit: number | null;
}
