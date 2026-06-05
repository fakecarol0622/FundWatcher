import type { FundEstimate } from "../types/fund";

export interface FundNavDisplay {
  label: string;
  value: number | null;
  usingOfficialNav: boolean;
}

function getDatePart(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const matched = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return matched?.[1] ?? null;
}

export function shouldPreferOfficialNav(estimate: FundEstimate | null | undefined): boolean {
  if (!estimate || estimate.nav === null) {
    return false;
  }

  if (estimate.estimatedNav === null) {
    return true;
  }

  const navDate = getDatePart(estimate.navDate);
  const estimateDate = getDatePart(estimate.estimateTime);

  if (!navDate) {
    return false;
  }

  if (!estimateDate) {
    return true;
  }

  return navDate >= estimateDate;
}

export function getFundNavDisplay(estimate: FundEstimate | null | undefined): FundNavDisplay {
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
