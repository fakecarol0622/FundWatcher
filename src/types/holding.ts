export interface Holding {
  fundCode: string;
  amount: number;
  currentProfit: number;
  note?: string;
  updatedAt: number;
}

export interface HoldingComputed {
  fundCode: string;
  fundName: string;
  amount: number;
  currentProfit: number;
  principalAmount: number;
  currentEstimatedNav: number | null;
  latestNav: number | null;
  latestMarketValue: number;
  estimatedMarketValue: number | null;
  estimatedProfit: number | null;
  estimatedProfitPercent: number | null;
  todayProfit: number | null;
}

export interface HoldingSummary {
  totalAmount: number;
  totalEstimatedMarketValue: number | null;
  totalEstimatedProfit: number | null;
  totalEstimatedProfitPercent: number | null;
  totalTodayProfit: number | null;
}
