import { defineStore } from "pinia";
import { fundDataSource } from "../services/fundDataSource";
import { getItem, setItem, STORAGE_KEYS } from "../services/storageService";
import { defaultSettings } from "../types/settings";
import type { DataStatus, FundEstimate, FundItem } from "../types/fund";

type FundEstimateMap = Record<string, FundEstimate>;
type FundEstimateStatusMap = Record<string, DataStatus>;

type FundInput = Pick<FundItem, "code"> &
  Partial<Omit<FundItem, "code" | "createdAt" | "updatedAt">>;

type FundUpdate = Partial<Omit<FundItem, "code" | "createdAt">>;

const DATA_SOURCE_NAME = "天天基金估值 JSONP";

function isValidFundCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

function buildErrorEstimate(code: string, message: string): FundEstimate {
  return {
    code,
    name: "",
    estimatedNav: null,
    estimatedGrowth: null,
    nav: null,
    navDate: null,
    estimateTime: null,
    source: DATA_SOURCE_NAME,
    error: message,
    cachedAt: Date.now(),
  };
}

export const useFundStore = defineStore("fund", {
  state: () => ({
    funds: getItem<FundItem[]>(STORAGE_KEYS.funds, []),
    estimates: getItem<FundEstimateMap>(STORAGE_KEYS.fundEstimatesCache, {}),
    estimateStatuses: {} as FundEstimateStatusMap,
    isRefreshingEstimates: false,
    lastRefreshAt: null as number | null,
  }),
  getters: {
    enabledFunds(state): FundItem[] {
      return state.funds.filter((fund) => fund.enabled);
    },
  },
  actions: {
    addFund(input: string | FundInput): FundItem | null {
      const now = Date.now();
      const fundInput = typeof input === "string" ? { code: input } : input;
      const code = fundInput.code.trim();
      const cachedEstimate = this.estimates[code];

      if (!isValidFundCode(code) || this.funds.some((fund) => fund.code === code)) {
        return null;
      }

      const fund: FundItem = {
        code,
        name: fundInput.name || cachedEstimate?.name || undefined,
        alias: fundInput.alias,
        enabled: fundInput.enabled ?? true,
        thresholdUp: fundInput.thresholdUp ?? defaultSettings.defaultThresholdUp,
        thresholdDown: fundInput.thresholdDown ?? defaultSettings.defaultThresholdDown,
        createdAt: now,
        updatedAt: now,
      };

      this.funds.push(fund);
      this.saveToStorage();
      return fund;
    },

    removeFund(code: string): void {
      this.funds = this.funds.filter((fund) => fund.code !== code);
      delete this.estimates[code];
      delete this.estimateStatuses[code];
      this.saveToStorage();
    },

    updateFund(code: string, patch: FundUpdate): FundItem | null {
      const fund = this.funds.find((item) => item.code === code);
      if (!fund) {
        return null;
      }

      Object.assign(fund, patch, { updatedAt: Date.now() });
      this.saveToStorage();
      return fund;
    },

    updateEstimate(estimate: FundEstimate): void {
      this.estimates[estimate.code] = {
        ...estimate,
        cachedAt: estimate.cachedAt ?? Date.now(),
      };

      const fund = this.funds.find((item) => item.code === estimate.code);
      if (fund && estimate.name && fund.name !== estimate.name) {
        fund.name = estimate.name;
        fund.updatedAt = Date.now();
      }

      this.saveToStorage();
    },

    getEstimateStatus(code: string): DataStatus {
      const activeStatus = this.estimateStatuses[code];
      if (activeStatus === "loading") {
        return activeStatus;
      }

      const estimate = this.estimates[code];
      if (!estimate) {
        return activeStatus ?? "idle";
      }

      if (estimate.stale) {
        return "stale";
      }

      if (estimate.error) {
        return "error";
      }

      return "success";
    },

    async refreshFundEstimate(code: string): Promise<FundEstimate> {
      const normalizedCode = code.trim();
      this.estimateStatuses[normalizedCode] = "loading";

      try {
        const estimate = await fundDataSource.getFundEstimate(normalizedCode);
        this.updateEstimate(estimate);
        this.estimateStatuses[normalizedCode] = estimate.stale
          ? "stale"
          : estimate.error
            ? "error"
            : "success";
        this.lastRefreshAt = Date.now();
        return estimate;
      } catch (error) {
        const message = error instanceof Error ? error.message : "基金估值刷新失败。";
        console.error("[fundStore] Failed to refresh a fund estimate.", error);

        const cachedEstimate = this.estimates[normalizedCode];
        if (cachedEstimate) {
          this.estimates[normalizedCode] = {
            ...cachedEstimate,
            error: message,
            stale: true,
            cachedAt: cachedEstimate.cachedAt ?? Date.now(),
          };
          this.estimateStatuses[normalizedCode] = "stale";
        } else {
          this.estimates[normalizedCode] = buildErrorEstimate(normalizedCode, message);
          this.estimateStatuses[normalizedCode] = "error";
        }

        this.saveToStorage();
        this.lastRefreshAt = Date.now();
        return this.estimates[normalizedCode];
      }
    },

    async refreshEnabledEstimates(): Promise<void> {
      const codes = this.enabledFunds.map((fund) => fund.code);
      if (codes.length === 0) {
        this.isRefreshingEstimates = false;
        return;
      }

      this.isRefreshingEstimates = true;
      codes.forEach((code) => {
        this.estimateStatuses[code] = "loading";
      });

      try {
        const estimates = await fundDataSource.getFundEstimates(codes);
        estimates.forEach((estimate) => {
          this.updateEstimate(estimate);
          this.estimateStatuses[estimate.code] = estimate.stale
            ? "stale"
            : estimate.error
              ? "error"
              : "success";
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "基金估值刷新失败。";
        console.error("[fundStore] Failed to refresh fund estimates.", error);

        codes.forEach((code) => {
          const cachedEstimate = this.estimates[code];
          if (cachedEstimate) {
            this.estimates[code] = {
              ...cachedEstimate,
              error: message,
              stale: true,
              cachedAt: cachedEstimate.cachedAt ?? Date.now(),
            };
            this.estimateStatuses[code] = "stale";
          } else {
            this.estimates[code] = buildErrorEstimate(code, message);
            this.estimateStatuses[code] = "error";
          }
        });

        this.saveToStorage();
      } finally {
        this.lastRefreshAt = Date.now();
        this.isRefreshingEstimates = false;
      }
    },

    loadFromStorage(): void {
      this.funds = getItem<FundItem[]>(STORAGE_KEYS.funds, []);
      this.estimates = getItem<FundEstimateMap>(STORAGE_KEYS.fundEstimatesCache, {});
    },

    saveToStorage(): void {
      setItem(STORAGE_KEYS.funds, this.funds);
      setItem(STORAGE_KEYS.fundEstimatesCache, this.estimates);
    },
  },
});
