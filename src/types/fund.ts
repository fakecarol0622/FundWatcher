export interface FundItem {
  code: string;
  name?: string;
  alias?: string;
  enabled: boolean;
  thresholdUp?: number;
  thresholdDown?: number;
  createdAt: number;
  updatedAt: number;
}

export interface FundEstimate {
  code: string;
  name: string;
  estimatedNav: number | null;
  estimatedGrowth: number | null;
  nav: number | null;
  navDate: string | null;
  estimateTime: string | null;
  source: string;
  error?: string;
  stale?: boolean;
  cachedAt?: number;
}

export type DataStatus = "idle" | "loading" | "success" | "error" | "stale";

export interface FundDataSource {
  getFundEstimate(code: string): Promise<FundEstimate>;
  getFundEstimates(codes: string[]): Promise<FundEstimate[]>;
}
