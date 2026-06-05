import type { FundEstimate } from "../types/fund";

export interface FundNavDisplay {
  label: string;
  value: number | null;
  usingOfficialNav: boolean;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function shouldPreferOfficialNav(
  estimate: FundEstimate | null | undefined,
): boolean {
  if (!estimate || estimate.nav === null) {
    return false;
  }

  return !isFiniteNumber(estimate.estimatedNav);
}

export function getFundNavDisplay(
  estimate: FundEstimate | null | undefined,
): FundNavDisplay {
  if (shouldPreferOfficialNav(estimate)) {
    return {
      label: "最新净值",
      value: estimate?.nav ?? null,
      usingOfficialNav: true,
    };
  }

  return {
    label: "估算净值",
    value: estimate?.estimatedNav ?? null,
    usingOfficialNav: false,
  };
}
