import type { AlertRecord } from "../types/alert";
import type { BackupData } from "../types/backup";
import type { FundItem } from "../types/fund";
import type { Holding } from "../types/holding";
import type { AppSettings, AppTheme } from "../types/settings";
import { getDateString } from "./timeService";

export const BACKUP_VERSION = "1.0.0";

type ValidationResult<T> = { valid: true; value: T } | { valid: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || isFiniteNumber(value);
}

function isAppTheme(value: unknown): value is AppTheme {
  return value === "light" || value === "dark" || value === "system";
}

function validateFundItem(value: unknown): ValidationResult<FundItem> {
  if (!isRecord(value)) {
    return { valid: false };
  }

  if (
    typeof value.code !== "string" ||
    typeof value.enabled !== "boolean" ||
    !isFiniteNumber(value.createdAt) ||
    !isFiniteNumber(value.updatedAt) ||
    !isOptionalString(value.alias) ||
    !isOptionalString(value.name) ||
    !isOptionalNumber(value.thresholdUp) ||
    !isOptionalNumber(value.thresholdDown)
  ) {
    return { valid: false };
  }

  return {
    valid: true,
    value: {
      code: value.code,
      enabled: value.enabled,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
      alias: value.alias,
      name: value.name,
      thresholdUp: value.thresholdUp,
      thresholdDown: value.thresholdDown,
    },
  };
}

function validateHolding(value: unknown): ValidationResult<Holding> {
  if (!isRecord(value)) {
    return { valid: false };
  }

  if (
    typeof value.fundCode !== "string" ||
    !isFiniteNumber(value.amount) ||
    !isFiniteNumber(value.currentProfit) ||
    !isFiniteNumber(value.updatedAt) ||
    !isOptionalString(value.note)
  ) {
    return { valid: false };
  }

  return {
    valid: true,
    value: {
      fundCode: value.fundCode,
      amount: value.amount,
      currentProfit: value.currentProfit,
      updatedAt: value.updatedAt,
      note: value.note,
    },
  };
}

function validateAlertRecord(value: unknown): ValidationResult<AlertRecord> {
  if (!isRecord(value)) {
    return { valid: false };
  }

  if (
    typeof value.id !== "string" ||
    typeof value.fundCode !== "string" ||
    typeof value.fundName !== "string" ||
    (value.type !== "up" && value.type !== "down") ||
    !isFiniteNumber(value.threshold) ||
    !isFiniteNumber(value.actualGrowth) ||
    typeof value.message !== "string" ||
    typeof value.date !== "string" ||
    !isFiniteNumber(value.triggeredAt)
  ) {
    return { valid: false };
  }

  return {
    valid: true,
    value: {
      id: value.id,
      fundCode: value.fundCode,
      fundName: value.fundName,
      type: value.type,
      threshold: value.threshold,
      actualGrowth: value.actualGrowth,
      message: value.message,
      date: value.date,
      triggeredAt: value.triggeredAt,
    },
  };
}

function validateSettings(value: unknown): ValidationResult<AppSettings> {
  if (!isRecord(value)) {
    return { valid: false };
  }

  if (
    !isFiniteNumber(value.refreshIntervalMinutes) ||
    typeof value.enableBrowserNotification !== "boolean" ||
    !isFiniteNumber(value.defaultThresholdUp) ||
    !isFiniteNumber(value.defaultThresholdDown) ||
    !isAppTheme(value.theme)
  ) {
    return { valid: false };
  }

  return {
    valid: true,
    value: {
      refreshIntervalMinutes: value.refreshIntervalMinutes,
      enableBrowserNotification: value.enableBrowserNotification,
      defaultThresholdUp: value.defaultThresholdUp,
      defaultThresholdDown: value.defaultThresholdDown,
      theme: value.theme,
    },
  };
}

function validateArray<T>(
  value: unknown,
  itemValidator: (item: unknown) => ValidationResult<T>,
): ValidationResult<T[]> {
  if (!Array.isArray(value)) {
    return { valid: false };
  }

  const parsedItems: T[] = [];

  for (const item of value) {
    const parsedItem = itemValidator(item);
    if (!parsedItem.valid) {
      return { valid: false };
    }

    parsedItems.push(parsedItem.value);
  }

  return { valid: true, value: parsedItems };
}

export function createBackupData(input: Omit<BackupData, "version" | "exportedAt">): BackupData {
  return {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    funds: input.funds,
    holdings: input.holdings,
    alerts: input.alerts,
    settings: input.settings,
  };
}

export function getBackupFileName(exportedAt: number): string {
  return `fund-watcher-backup-${getDateString(new Date(exportedAt))}.json`;
}

export function downloadBackupJson(data: BackupData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = getBackupFileName(data.exportedAt);
  link.click();

  URL.revokeObjectURL(url);
}

export function parseBackupJson(raw: string): BackupData {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    console.error("[backupService] Failed to parse backup JSON.", error);
    throw new Error("JSON 格式无效，无法解析备份文件。");
  }

  if (!isRecord(parsed)) {
    throw new Error("备份文件必须是 JSON 对象。");
  }

  if (!("version" in parsed)) {
    throw new Error("备份文件缺少 version 字段。");
  }

  if (!("exportedAt" in parsed)) {
    throw new Error("备份文件缺少 exportedAt 字段。");
  }

  if (!("funds" in parsed)) {
    throw new Error("备份文件缺少 funds 字段。");
  }

  if (!("holdings" in parsed)) {
    throw new Error("备份文件缺少 holdings 字段。");
  }

  if (!("alerts" in parsed)) {
    throw new Error("备份文件缺少 alerts 字段。");
  }

  if (!("settings" in parsed)) {
    throw new Error("备份文件缺少 settings 字段。");
  }

  if (typeof parsed.version !== "string" || parsed.version.trim().length === 0) {
    throw new Error("备份文件的 version 字段无效。");
  }

  if (parsed.version !== BACKUP_VERSION) {
    throw new Error(`当前仅支持导入 version 为 ${BACKUP_VERSION} 的备份文件。`);
  }

  if (!isFiniteNumber(parsed.exportedAt)) {
    throw new Error("备份文件的 exportedAt 字段无效。");
  }

  const funds = validateArray(parsed.funds, validateFundItem);
  if (!funds.valid) {
    throw new Error("备份文件中的 funds 数据格式无效。");
  }

  const holdings = validateArray(parsed.holdings, validateHolding);
  if (!holdings.valid) {
    throw new Error("备份文件中的 holdings 数据格式无效。");
  }

  const alerts = validateArray(parsed.alerts, validateAlertRecord);
  if (!alerts.valid) {
    throw new Error("备份文件中的 alerts 数据格式无效。");
  }

  const settings = validateSettings(parsed.settings);
  if (!settings.valid) {
    throw new Error("备份文件中的 settings 数据格式无效。");
  }

  return {
    version: parsed.version,
    exportedAt: parsed.exportedAt,
    funds: funds.value,
    holdings: holdings.value,
    alerts: alerts.value,
    settings: settings.value,
  };
}

export async function readBackupFile(file: File): Promise<BackupData> {
  const raw = await file.text();
  return parseBackupJson(raw);
}
