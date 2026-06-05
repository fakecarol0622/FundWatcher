import { defineStore } from "pinia";
import type { FundEstimate, FundItem } from "../types/fund";
import type { Holding, HoldingComputed, HoldingSummary } from "../types/holding";
import { getItem, setItem, STORAGE_KEYS } from "../services/storageService";
import { useFundStore } from "./fundStore";

type HoldingInput = Omit<Holding, "updatedAt"> & Partial<Pick<Holding, "updatedAt">>;
type FundEstimateMap = Record<string, FundEstimate>;
type HoldingValidationResult =
  | { valid: true; fundCode: string }
  | { valid: false; message: string };

const emptyHoldingSummary: HoldingSummary = {
  totalAmount: 0,
  totalEstimatedMarketValue: null,
  totalEstimatedProfit: null,
  totalEstimatedProfitPercent: null,
  totalTodayProfit: null,
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function validateHoldingInput(
  input: HoldingInput,
  funds: FundItem[],
): HoldingValidationResult {
  const fundCode = input.fundCode.trim();

  if (!fundCode || !funds.some((fund) => fund.code === fundCode)) {
    return { valid: false, message: "请选择已添加的基金" };
  }

  if (!isPositiveFiniteNumber(input.amount)) {
    return { valid: false, message: "持有金额必须大于 0" };
  }

  if (!isFiniteNumber(input.currentProfit)) {
    return { valid: false, message: "目前已有收益必须填写数字" };
  }

  if (input.amount - input.currentProfit <= 0) {
    return { valid: false, message: "持有金额必须大于目前已有收益，才能得到有效本金" };
  }

  return { valid: true, fundCode };
}

function getFundName(fund: FundItem, estimate: FundEstimate | undefined): string {
  return estimate?.name || fund.name || "未命名基金";
}

function computeEstimatedMarketValue(
  latestMarketValue: number,
  estimate: FundEstimate | undefined,
): number | null {
  const currentEstimatedNav = estimate?.estimatedNav ?? null;
  const latestNav = estimate?.nav ?? null;

  if (
    !isPositiveFiniteNumber(latestMarketValue) ||
    currentEstimatedNav === null ||
    !isPositiveFiniteNumber(latestNav)
  ) {
    return null;
  }

  return latestMarketValue * (currentEstimatedNav / latestNav);
}

function computeHolding(
  holding: Holding,
  fund: FundItem,
  estimate: FundEstimate | undefined,
): HoldingComputed {
  const currentEstimatedNav = estimate?.estimatedNav ?? null;
  const latestNav = estimate?.nav ?? null;
  const principalAmount = holding.amount - holding.currentProfit;
  const latestMarketValue = holding.amount;
  const estimatedMarketValue = computeEstimatedMarketValue(latestMarketValue, estimate);
  const todayProfit =
    estimatedMarketValue === null ? null : estimatedMarketValue - latestMarketValue;
  const estimatedProfit = todayProfit === null ? null : holding.currentProfit + todayProfit;
  const estimatedProfitPercent =
    estimatedProfit === null || !isPositiveFiniteNumber(principalAmount)
      ? null
      : (estimatedProfit / principalAmount) * 100;

  return {
    fundCode: holding.fundCode,
    fundName: getFundName(fund, estimate),
    amount: holding.amount,
    currentProfit: holding.currentProfit,
    principalAmount,
    currentEstimatedNav,
    latestNav,
    latestMarketValue,
    estimatedMarketValue,
    estimatedProfit,
    estimatedProfitPercent,
    todayProfit,
  };
}

function computeHoldingRows(
  holdings: Holding[],
  funds: FundItem[],
  estimates: FundEstimateMap,
): HoldingComputed[] {
  return holdings
    .map((holding) => {
      const fund = funds.find((item) => item.code === holding.fundCode);
      return fund ? computeHolding(holding, fund, estimates[holding.fundCode]) : null;
    })
    .filter((row): row is HoldingComputed => row !== null);
}

function sumNullable(rows: HoldingComputed[], field: keyof HoldingComputed): number | null {
  if (rows.length === 0 || rows.some((row) => row[field] === null)) {
    return null;
  }

  return rows.reduce((total, row) => total + Number(row[field]), 0);
}

function computeSummary(rows: HoldingComputed[]): HoldingSummary {
  if (rows.length === 0) {
    return emptyHoldingSummary;
  }

  const totalAmount = rows.reduce((total, row) => total + row.amount, 0);
  const totalPrincipalAmount = rows.reduce((total, row) => total + row.principalAmount, 0);
  const totalEstimatedMarketValue = sumNullable(rows, "estimatedMarketValue");
  const totalEstimatedProfit = sumNullable(rows, "estimatedProfit");
  const totalEstimatedProfitPercent =
    totalEstimatedProfit === null || !isPositiveFiniteNumber(totalPrincipalAmount)
      ? null
      : (totalEstimatedProfit / totalPrincipalAmount) * 100;
  const totalTodayProfit = sumNullable(rows, "todayProfit");

  return {
    totalAmount,
    totalEstimatedMarketValue,
    totalEstimatedProfit,
    totalEstimatedProfitPercent,
    totalTodayProfit,
  };
}

export const useHoldingStore = defineStore("holding", {
  state: () => ({
    holdings: getItem<Holding[]>(STORAGE_KEYS.holdings, []),
  }),
  getters: {
    computedHoldings(state): HoldingComputed[] {
      const fundStore = useFundStore();
      return computeHoldingRows(state.holdings, fundStore.funds, fundStore.estimates);
    },

    summary(): HoldingSummary {
      return computeSummary(this.computedHoldings);
    },
  },
  actions: {
    validateHoldingInput(input: HoldingInput): HoldingValidationResult {
      const fundStore = useFundStore();
      return validateHoldingInput(input, fundStore.funds);
    },

    addOrUpdateHolding(input: HoldingInput): Holding | null {
      const validation = this.validateHoldingInput(input);
      if (!validation.valid) {
        return null;
      }

      const holding: Holding = {
        fundCode: validation.fundCode,
        amount: input.amount,
        currentProfit: input.currentProfit,
        note: input.note?.trim() || undefined,
        updatedAt: input.updatedAt ?? Date.now(),
      };

      const existingIndex = this.holdings.findIndex((item) => item.fundCode === holding.fundCode);

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
