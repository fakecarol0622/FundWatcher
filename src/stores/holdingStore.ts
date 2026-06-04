import { defineStore } from "pinia";
import type { Holding } from "../types/holding";
import { getItem, setItem, STORAGE_KEYS } from "../services/storageService";

type HoldingInput = Omit<Holding, "updatedAt"> & Partial<Pick<Holding, "updatedAt">>;

export const useHoldingStore = defineStore("holding", {
  state: () => ({
    holdings: getItem<Holding[]>(STORAGE_KEYS.holdings, []),
  }),
  actions: {
    addOrUpdateHolding(input: HoldingInput): Holding | null {
      if (!input.fundCode || input.shares <= 0 || input.costNav <= 0) {
        return null;
      }

      const holding: Holding = {
        fundCode: input.fundCode,
        shares: input.shares,
        costNav: input.costNav,
        note: input.note,
        updatedAt: input.updatedAt ?? Date.now(),
      };

      const existingIndex = this.holdings.findIndex(
        (item) => item.fundCode === holding.fundCode,
      );

      if (existingIndex >= 0) {
        this.holdings[existingIndex] = holding;
      } else {
        this.holdings.push(holding);
      }

      this.saveToStorage();
      return holding;
    },

    removeHolding(fundCode: string): void {
      this.holdings = this.holdings.filter((holding) => holding.fundCode !== fundCode);
      this.saveToStorage();
    },

    loadFromStorage(): void {
      this.holdings = getItem<Holding[]>(STORAGE_KEYS.holdings, []);
    },

    saveToStorage(): void {
      setItem(STORAGE_KEYS.holdings, this.holdings);
    },
  },
});
