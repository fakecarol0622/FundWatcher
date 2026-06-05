import type { FundEstimate } from "../types/fund";
import { getItem, setItem, STORAGE_KEYS } from "./storageService";

export interface FundDataSource {
  getFundEstimate(code: string): Promise<FundEstimate>;
  getFundEstimates(codes: string[]): Promise<FundEstimate[]>;
}

interface FundDataSourceOptions {
  timeoutMs?: number;
  concurrency?: number;
}

interface EastmoneyFundEstimatePayload {
  fundcode?: string;
  name?: string;
  jzrq?: string;
  dwjz?: string;
  gsz?: string;
  gszzl?: string;
  gztime?: string;
}

type FundEstimateCache = Record<string, FundEstimate>;

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_CONCURRENCY = 5;
const DATA_SOURCE_NAME = "天天基金估值 JSONP";
const CACHE_KEY = STORAGE_KEYS.fundEstimatesCache;

let jsonpSequence = 0;
const fixedJsonpCallbacks = new Map<string, Set<(payload: EastmoneyFundEstimatePayload) => void>>();

function normalizeFundCode(code: string): string {
  return code.trim();
}

function isValidFundCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

function parseNullableNumber(value: string | undefined): number | null {
  if (value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getCache(): FundEstimateCache {
  return getItem<FundEstimateCache>(CACHE_KEY, {});
}

function getCachedEstimate(code: string): FundEstimate | null {
  return getCache()[code] ?? null;
}

function setCachedEstimate(estimate: FundEstimate): void {
  const cache = getCache();
  cache[estimate.code] = {
    ...estimate,
    error: undefined,
    stale: false,
    cachedAt: Date.now(),
  };
  setItem(CACHE_KEY, cache);
}

function buildEmptyEstimate(code: string, error: string): FundEstimate {
  return {
    code,
    name: "",
    estimatedNav: null,
    estimatedGrowth: null,
    nav: null,
    navDate: null,
    estimateTime: null,
    source: DATA_SOURCE_NAME,
    error,
  };
}

function buildErrorEstimate(code: string, error: string): FundEstimate {
  const cached = getCachedEstimate(code);

  if (!cached) {
    return buildEmptyEstimate(code, error);
  }

  return {
    ...cached,
    source: cached.source || DATA_SOURCE_NAME,
    error,
    stale: true,
    cachedAt: cached.cachedAt ?? Date.now(),
  };
}

function mapEastmoneyPayload(payload: EastmoneyFundEstimatePayload, code: string): FundEstimate {
  return {
    code: payload.fundcode || code,
    name: payload.name || "",
    estimatedNav: parseNullableNumber(payload.gsz),
    estimatedGrowth: parseNullableNumber(payload.gszzl),
    nav: parseNullableNumber(payload.dwjz),
    navDate: payload.jzrq || null,
    estimateTime: payload.gztime || null,
    source: DATA_SOURCE_NAME,
  };
}

function registerFixedJsonpCallback(
  code: string,
  callback: (payload: EastmoneyFundEstimatePayload) => void,
): void {
  const callbacks = fixedJsonpCallbacks.get(code) ?? new Set();
  callbacks.add(callback);
  fixedJsonpCallbacks.set(code, callbacks);

  // Some versions of the non-official endpoint ignore custom callback names and call jsonpgz.
  (window as unknown as Record<string, unknown>).jsonpgz = (payload: EastmoneyFundEstimatePayload) => {
    const payloadCode = payload.fundcode;
    if (!payloadCode) {
      return;
    }

    const pendingCallbacks = fixedJsonpCallbacks.get(payloadCode);
    if (!pendingCallbacks) {
      return;
    }

    pendingCallbacks.forEach((pendingCallback) => pendingCallback(payload));
  };
}

function unregisterFixedJsonpCallback(
  code: string,
  callback: (payload: EastmoneyFundEstimatePayload) => void,
): void {
  const callbacks = fixedJsonpCallbacks.get(code);
  if (!callbacks) {
    return;
  }

  callbacks.delete(callback);
  if (callbacks.size === 0) {
    fixedJsonpCallbacks.delete(code);
  }
}

function requestJsonp<T extends EastmoneyFundEstimatePayload>(
  url: string,
  timeoutMs: number,
  code: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      reject(new Error("JSONP only works in a browser environment."));
      return;
    }

    const callbackName = `__fundWatcherJsonp_${Date.now()}_${jsonpSequence}`;
    jsonpSequence += 1;

    const script = document.createElement("script");
    const cleanup = () => {
      script.remove();
      delete (window as unknown as Record<string, unknown>)[callbackName];
      unregisterFixedJsonpCallback(code, completeFixedCallback);
    };

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Request timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    const complete = (payload: T) => {
      window.clearTimeout(timer);
      cleanup();
      resolve(payload);
    };

    const completeFixedCallback = (payload: EastmoneyFundEstimatePayload) => {
      complete(payload as T);
    };

    (window as unknown as Record<string, unknown>)[callbackName] = complete;
    registerFixedJsonpCallback(code, completeFixedCallback);

    script.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      reject(new Error("JSONP script failed to load."));
    };

    const separator = url.includes("?") ? "&" : "?";
    script.src = `${url}${separator}callback=${callbackName}`;
    document.head.appendChild(script);
  });
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runNext(): Promise<void> {
    const currentIndex = nextIndex;
    nextIndex += 1;

    if (currentIndex >= items.length) {
      return;
    }

    results[currentIndex] = await worker(items[currentIndex]);
    await runNext();
  }

  const workerCount = Math.min(Math.max(concurrency, 1), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runNext()));
  return results;
}

export function createFundDataSource(options: FundDataSourceOptions = {}): FundDataSource {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

  return {
    async getFundEstimate(rawCode: string): Promise<FundEstimate> {
      const code = normalizeFundCode(rawCode);

      if (!isValidFundCode(code)) {
        return buildErrorEstimate(code, "基金代码必须为 6 位数字。");
      }

      try {
        // Non-official data source: Eastmoney/Tiantian Fund public estimate JSONP endpoint.
        // Keep this service replaceable so UI components never depend on the endpoint directly.
        const url = `https://fundgz.1234567.com.cn/js/${code}.js?rt=${Date.now()}`;
        const payload = await requestJsonp<EastmoneyFundEstimatePayload>(url, timeoutMs, code);
        const estimate = mapEastmoneyPayload(payload, code);

        if (!estimate.name && estimate.estimatedNav === null && estimate.nav === null) {
          return buildErrorEstimate(code, "第三方接口未返回有效基金估值数据。");
        }

        setCachedEstimate(estimate);
        return estimate;
      } catch (error) {
        const message = error instanceof Error ? error.message : "基金估值接口请求失败。";
        return buildErrorEstimate(code, message);
      }
    },

    async getFundEstimates(codes: string[]): Promise<FundEstimate[]> {
      const normalizedCodes = codes.map(normalizeFundCode);
      return runWithConcurrency(normalizedCodes, concurrency, (code) => this.getFundEstimate(code));
    },
  };
}

export const fundDataSource = createFundDataSource();

export async function debugGetFundEstimate(code = "161725"): Promise<FundEstimate> {
  const estimate = await fundDataSource.getFundEstimate(code);
  console.info("[fundDataSource] debug estimate", estimate);
  return estimate;
}
