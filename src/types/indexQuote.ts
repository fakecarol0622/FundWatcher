export type IndexMarketStatus = "open" | "closed" | "unknown";

export interface IndexQuote {
  code: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  previousClose: number | null;
  updateTime: string | null;
  marketStatus: IndexMarketStatus;
  source: string;
  error?: string;
  stale?: boolean;
  cachedAt?: number;
}

export interface IndexDataSource {
  getIndexQuotes(codes: string[]): Promise<IndexQuote[]>;
}

export interface CacheItem<T> {
  data: T;
  updatedAt: number;
  source: string;
}
