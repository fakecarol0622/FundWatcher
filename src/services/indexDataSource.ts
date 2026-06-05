import type { IndexMarketStatus, IndexQuote } from "../types/indexQuote";
import { getItem, setItem, STORAGE_KEYS } from "./storageService";
import { isAStockTradingTime } from "./timeService";

export interface IndexDataSource {
  getIndexQuotes(codes: string[]): Promise<IndexQuote[]>;
}

interface IndexDataSourceOptions {
  timeoutMs?: number;
}

export interface IndexDefinition {
  code: string;
  name: string;
  symbol: string | null;
  market: "a-share" | "hk" | "us";
  quoteFormat: "tencent-full" | null;
}

type IndexQuoteCache = Record<string, IndexQuote>;

const DEFAULT_TIMEOUT_MS = 10_000;
const DATA_SOURCE_NAME = "腾讯行情脚本接口";
const CACHE_KEY = STORAGE_KEYS.indexQuotesCache;

export const A_SHARE_INDEXES: IndexDefinition[] = [
  { code: "000001", name: "上证指数", symbol: "sh000001", market: "a-share", quoteFormat: "tencent-full" },
  { code: "399001", name: "深证成指", symbol: "sz399001", market: "a-share", quoteFormat: "tencent-full" },
  { code: "399006", name: "创业板指", symbol: "sz399006", market: "a-share", quoteFormat: "tencent-full" },
  { code: "000300", name: "沪深300", symbol: "sh000300", market: "a-share", quoteFormat: "tencent-full" },
  { code: "000905", name: "中证500", symbol: "sh000905", market: "a-share", quoteFormat: "tencent-full" },
];

export const HK_INDEXES: IndexDefinition[] = [
  { code: "HSI", name: "恒生指数", symbol: "hkHSI", market: "hk", quoteFormat: "tencent-full" },
  { code: "HSTECH", name: "恒生科技", symbol: "hkHSTECH", market: "hk", quoteFormat: "tencent-full" },
];

export const US_INDEXES: IndexDefinition[] = [
  { code: "IXIC", name: "纳斯达克综合指数", symbol: "usIXIC", market: "us", quoteFormat: "tencent-full" },
  { code: "NDX", name: "纳斯达克100", symbol: "usNDX", market: "us", quoteFormat: "tencent-full" },
  { code: "SPX", name: "标普500", symbol: "usINX", market: "us", quoteFormat: "tencent-full" },
  { code: "DJI", name: "道琼斯指数", symbol: "usDJI", market: "us", quoteFormat: "tencent-full" },
  { code: "VIX", name: "VIX 恐慌指数", symbol: "usVIX", market: "us", quoteFormat: "tencent-full" },
];

export const RESERVED_OVERSEAS_INDEXES: IndexDefinition[] = [];

export const DEFAULT_INDEXES = [...A_SHARE_INDEXES, ...HK_INDEXES, ...US_INDEXES];
export const DEFAULT_INDEX_CODES = DEFAULT_INDEXES.map((index) => index.code);

let scriptSequence = 0;

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function getIndexDefinitions(): Map<string, IndexDefinition> {
  return new Map(
    [...DEFAULT_INDEXES, ...RESERVED_OVERSEAS_INDEXES].map((definition) => [
      normalizeCode(definition.code),
      definition,
    ]),
  );
}

function getCache(): IndexQuoteCache {
  const cache = getItem<IndexQuoteCache>(CACHE_KEY, {});

  if (cache.SPX?.error || cache.VIX?.name !== "VIX 恐慌指数") {
    delete cache.SPX;
    delete cache.VIX;
    setItem(CACHE_KEY, cache);
  }

  return cache;
}

function getCachedQuote(code: string): IndexQuote | null {
  return getCache()[normalizeCode(code)] ?? null;
}

function setCachedQuotes(quotes: IndexQuote[]): void {
  const cache = getCache();
  const now = Date.now();

  quotes.forEach((quote) => {
    if (quote.error || quote.stale) {
      return;
    }

    cache[normalizeCode(quote.code)] = {
      ...quote,
      error: undefined,
      stale: false,
      cachedAt: now,
    };
  });

  setItem(CACHE_KEY, cache);
}

function parseNullableNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatTencentDateTime(value: string | undefined): string {
  if (!value || !/^\d{14}$/.test(value)) {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(Date.now());
  }

  const year = value.slice(0, 4);
  const month = value.slice(4, 6);
  const day = value.slice(6, 8);
  const hour = value.slice(8, 10);
  const minute = value.slice(10, 12);

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function getTimePartsInZone(now: Date, timeZone: string): {
  weekday: number;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const weekdayText = parts.find((part) => part.type === "weekday")?.value ?? "";
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    weekday: weekdays[weekdayText] ?? -1,
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? 0),
    minute: Number(parts.find((part) => part.type === "minute")?.value ?? 0),
  };
}

function isUsRegularTradingTime(now = new Date()): boolean {
  const { weekday, hour, minute } = getTimePartsInZone(now, "America/New_York");
  if (weekday === 0 || weekday === 6 || weekday === -1) {
    return false;
  }

  const minutes = hour * 60 + minute;
  const open = 9 * 60 + 30;
  const close = 16 * 60;

  return minutes >= open && minutes <= close;
}

function isHkRegularTradingTime(now = new Date()): boolean {
  const { weekday, hour, minute } = getTimePartsInZone(now, "Asia/Hong_Kong");
  if (weekday === 0 || weekday === 6 || weekday === -1) {
    return false;
  }

  const minutes = hour * 60 + minute;
  const morningOpen = 9 * 60 + 30;
  const morningClose = 12 * 60;
  const afternoonOpen = 13 * 60;
  const afternoonClose = 16 * 60;

  return (
    (minutes >= morningOpen && minutes <= morningClose) ||
    (minutes >= afternoonOpen && minutes <= afternoonClose)
  );
}

function getMarketStatus(definition: IndexDefinition): IndexMarketStatus {
  if (definition.market === "a-share") {
    return isAStockTradingTime() ? "open" : "closed";
  }

  if (definition.market === "hk") {
    return isHkRegularTradingTime() ? "open" : "closed";
  }

  if (definition.market === "us") {
    return isUsRegularTradingTime() ? "open" : "closed";
  }

  return "unknown";
}

function buildEmptyQuote(definition: IndexDefinition, error: string): IndexQuote {
  return {
    code: definition.code,
    name: definition.name,
    price: null,
    change: null,
    changePercent: null,
    previousClose: null,
    updateTime: null,
    marketStatus: getMarketStatus(definition),
    source: DATA_SOURCE_NAME,
    error,
  };
}

function buildErrorQuote(definition: IndexDefinition, error: string): IndexQuote {
  const cached = getCachedQuote(definition.code);

  if (!cached) {
    return buildEmptyQuote(definition, error);
  }

  return {
    ...cached,
    name: definition.name,
    source: cached.source || DATA_SOURCE_NAME,
    error,
    stale: true,
    cachedAt: cached.cachedAt ?? Date.now(),
  };
}

function buildQuoteFromFields(
  definition: IndexDefinition,
  values: {
    price: number | null;
    change: number | null;
    changePercent: number | null;
    previousClose: number | null;
    updateTime: string;
    source?: string;
  },
): IndexQuote {
  return {
    code: definition.code,
    name: definition.name,
    price: values.price,
    change: values.change,
    changePercent: values.changePercent,
    previousClose: values.previousClose,
    updateTime: values.updateTime,
    marketStatus: getMarketStatus(definition),
    source: values.source ?? DATA_SOURCE_NAME,
  };
}

function parseTencentFullQuote(definition: IndexDefinition, rawValue: string): IndexQuote {
  const fields = rawValue.split("~");
  const price = parseNullableNumber(fields[3]);
  const previousClose = parseNullableNumber(fields[4]);
  const parsedChange = parseNullableNumber(fields[31]);
  const change =
    parsedChange ??
    (price !== null && previousClose !== null ? Number((price - previousClose).toFixed(2)) : null);
  const parsedChangePercent = parseNullableNumber(fields[32]);
  const changePercent =
    parsedChangePercent ??
    (change !== null && previousClose !== null && previousClose !== 0
      ? Number(((change / previousClose) * 100).toFixed(2))
      : null);

  return buildQuoteFromFields(definition, {
    price,
    change,
    changePercent,
    previousClose,
    updateTime: formatTencentDateTime(fields[30]),
  });
}

function parseTencentQuote(definition: IndexDefinition, rawValue: string | undefined): IndexQuote {
  if (!rawValue) {
    return buildErrorQuote(definition, "第三方接口未返回该指数行情。");
  }

  const quote = parseTencentFullQuote(definition, rawValue);

  if (quote.price === null && quote.change === null && quote.changePercent === null) {
    return buildErrorQuote(definition, "第三方接口返回的指数行情无效。");
  }

  return quote;
}

function requestTencentScript(symbols: string[], timeoutMs: number): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      reject(new Error("指数行情脚本接口只能在浏览器环境中运行。"));
      return;
    }

    const requestSymbols = symbols.join(",");
    const script = document.createElement("script");
    const scriptId = scriptSequence;
    scriptSequence += 1;

    const cleanup = () => {
      script.remove();
    };

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(`指数行情请求超时：${timeoutMs}ms。`));
    }, timeoutMs);

    script.onload = () => {
      window.clearTimeout(timer);
      cleanup();

      const result: Record<string, string> = {};
      const globalWindow = window as unknown as Record<string, unknown>;

      symbols.forEach((symbol) => {
        const key = `v_${symbol}`;
        const value = globalWindow[key];
        if (typeof value === "string") {
          result[symbol] = value;
        }
      });

      resolve(result);
    };

    script.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      reject(new Error("指数行情脚本加载失败。"));
    };

    // Non-official data source: Tencent Finance quote script endpoint.
    // It is isolated here so the UI can switch data sources without changing components.
    script.src = `https://qt.gtimg.cn/q=${encodeURIComponent(requestSymbols)}&_=${Date.now()}_${scriptId}`;
    document.head.appendChild(script);
  });
}

export function createIndexDataSource(options: IndexDataSourceOptions = {}): IndexDataSource {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const definitions = getIndexDefinitions();

  return {
    async getIndexQuotes(rawCodes: string[]): Promise<IndexQuote[]> {
      const requestedDefinitions = rawCodes.map((rawCode) => {
        const code = normalizeCode(rawCode);
        return definitions.get(code) ?? {
          code,
          name: code,
          symbol: null,
          market: "a-share" as const,
          quoteFormat: null,
        };
      });

      const implementedDefinitions = requestedDefinitions.filter((definition) => definition.symbol);
      const reservedQuotes = requestedDefinitions
        .filter((definition) => !definition.symbol)
        .map((definition) => buildErrorQuote(definition, "该指数数据源暂未实现。"));

      if (implementedDefinitions.length === 0) {
        return reservedQuotes;
      }

      try {
        const symbols = implementedDefinitions.map((definition) => definition.symbol as string);
        const payload = await requestTencentScript(symbols, timeoutMs);
        const fetchedQuotes = implementedDefinitions.map((definition) =>
          parseTencentQuote(definition, payload[definition.symbol as string]),
        );

        setCachedQuotes(fetchedQuotes);
        return [...fetchedQuotes, ...reservedQuotes];
      } catch (error) {
        const message = error instanceof Error ? error.message : "指数行情接口请求失败。";
        const errorQuotes = implementedDefinitions.map((definition) =>
          buildErrorQuote(definition, message),
        );

        return [...errorQuotes, ...reservedQuotes];
      }
    },
  };
}

export const indexDataSource = createIndexDataSource();
