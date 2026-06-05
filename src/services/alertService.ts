import type { FundEstimate, FundItem } from "../types/fund";
import type { AlertRecord, AlertType } from "../types/alert";
import type { useAlertStore } from "../stores/alertStore";
import type { useSettingsStore } from "../stores/settingsStore";
import { buildAlertRecordKey } from "../stores/alertStore";
import { getDateString } from "./timeService";
import {
  showBrowserNotification,
  showToastNotification,
} from "./notificationService";

type AlertStoreInstance = ReturnType<typeof useAlertStore>;
type SettingsStoreInstance = ReturnType<typeof useSettingsStore>;

export interface TriggerAlertInput {
  fund: FundItem;
  estimate: FundEstimate;
  type: AlertType;
  threshold: number;
  date?: string;
}

export interface CheckFundAlertsInput {
  funds: FundItem[];
  estimates: Record<string, FundEstimate | undefined>;
  alertStore: AlertStoreInstance;
  settingsStore: SettingsStoreInstance;
  date?: string;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function getFundDisplayName(fund: FundItem, estimate: FundEstimate): string {
  return estimate.name || fund.name || fund.code;
}

function createAlertMessage(
  fundName: string,
  type: AlertType,
  threshold: number,
  actualGrowth: number,
): string {
  const directionText = type === "up" ? "上涨" : "下跌";
  return `${fundName} ${directionText}提醒：当前估算涨跌幅 ${actualGrowth.toFixed(2)}%，已达到阈值 ${threshold.toFixed(2)}%。`;
}

function createAlertRecord(
  input: TriggerAlertInput,
  date: string,
): Omit<AlertRecord, "triggeredAt"> {
  const fundName = getFundDisplayName(input.fund, input.estimate);
  const actualGrowth = input.estimate.estimatedGrowth as number;
  const id = buildAlertRecordKey(
    input.fund.code,
    input.type,
    input.threshold,
    date,
  );

  return {
    id,
    fundCode: input.fund.code,
    fundName,
    type: input.type,
    threshold: input.threshold,
    actualGrowth,
    message: createAlertMessage(
      fundName,
      input.type,
      input.threshold,
      actualGrowth,
    ),
    date,
  };
}

function shouldTriggerUpAlert(
  estimatedGrowth: number | null | undefined,
  threshold: number | undefined,
): threshold is number {
  return (
    isFiniteNumber(estimatedGrowth) &&
    isFiniteNumber(threshold) &&
    estimatedGrowth >= threshold
  );
}

function shouldTriggerDownAlert(
  estimatedGrowth: number | null | undefined,
  threshold: number | undefined,
): threshold is number {
  return (
    isFiniteNumber(estimatedGrowth) &&
    isFiniteNumber(threshold) &&
    estimatedGrowth <= threshold
  );
}

export function triggerAlert(
  input: TriggerAlertInput,
  alertStore: AlertStoreInstance,
  settingsStore: SettingsStoreInstance,
): AlertRecord {
  const date = input.date ?? getDateString();
  const record = alertStore.addAlertRecord(createAlertRecord(input, date));

  showToastNotification({
    title: input.type === "up" ? "上涨提醒" : "下跌提醒",
    body: record.message,
  });

  showBrowserNotification(
    {
      title: `基金提醒：${record.fundName}`,
      body: record.message,
      tag: record.id,
    },
    settingsStore.enableBrowserNotification,
  );

  return record;
}

export function checkFundAlerts(input: CheckFundAlertsInput): AlertRecord[] {
  const date = input.date ?? getDateString();
  const triggeredRecords: AlertRecord[] = [];

  input.funds.forEach((fund) => {
    if (!fund.enabled) {
      return;
    }

    const estimate = input.estimates[fund.code];
    if (
      !estimate ||
      estimate.error ||
      estimate.stale ||
      !isFiniteNumber(estimate.estimatedGrowth)
    ) {
      return;
    }

    const estimatedGrowth = estimate.estimatedGrowth;

    if (
      shouldTriggerUpAlert(estimatedGrowth, fund.thresholdUp) &&
      !input.alertStore.hasAlertedToday(fund.code, "up", fund.thresholdUp, date)
    ) {
      triggeredRecords.push(
        triggerAlert(
          {
            fund,
            estimate,
            type: "up",
            threshold: fund.thresholdUp,
            date,
          },
          input.alertStore,
          input.settingsStore,
        ),
      );
    }

    if (
      shouldTriggerDownAlert(estimatedGrowth, fund.thresholdDown) &&
      !input.alertStore.hasAlertedToday(
        fund.code,
        "down",
        fund.thresholdDown,
        date,
      )
    ) {
      triggeredRecords.push(
        triggerAlert(
          {
            fund,
            estimate,
            type: "down",
            threshold: fund.thresholdDown,
            date,
          },
          input.alertStore,
          input.settingsStore,
        ),
      );
    }
  });

  return triggeredRecords;
}
