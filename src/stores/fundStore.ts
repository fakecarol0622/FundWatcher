import { defineStore } from "pinia";
import { defaultSettings } from "../types/settings";
import type { FundEstimate, FundItem } from "../types/fund";
import { getItem, setItem, STORAGE_KEYS } from "../services/storageService";

type FundEstimateMap = Record<string, FundEstimate>;

type FundInput = Pick<FundItem, "code"> &
  Partial<Omit<FundItem, "code" | "createdAt" | "updatedAt">>;

type FundUpdate = Partial<Omit<FundItem, "code" | "createdAt">>;

function isValidFundCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

export const useFundStore = defineStore("fund", {
  state: () => ({
    funds: getItem<FundItem[]>(STORAGE_KEYS.funds, []),
    estimates: getItem<FundEstimateMap>(STORAGE_KEYS.fundEstimatesCache, {}),
  }),
  actions: {
    addFund(input: string | FundInput): FundItem | null {
      const now = Date.now();
      const fundInput = typeof input === "string" ? { code: input } : input;
      const code = fundInput.code.trim();

      if (!isValidFundCode(code) || this.funds.some((fund) => fund.code === code)) {
        return null;
      }

      const fund: FundItem = {
        code,
        name: fundInput.name,
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
      this.saveToStorage();
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
