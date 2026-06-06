import type {
  BackgroundFundItem,
  BackgroundMonitorConfig,
  Env,
  NotifyConfig,
} from "../types";

export const BACKGROUND_CONFIG_KEY = "fund-watcher:background-config";

const DEFAULT_VERSION = "1.0.0";
const DEFAULT_TIMEZONE = "Asia/Shanghai";
const DEFAULT_REFRESH_CRON = "*/30 * * * *";
const FUND_CODE_RE = /^\d{6}$/;

type PlainObject = Record<string, unknown>;

export interface ValidationResult {
  ok: true;
  data: BackgroundMonitorConfig;
}

export interface ValidationError {
  ok: false;
  error: string;
}

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getKv(env: Env): KVNamespace {
  if (!env.FUND_WATCHER_KV) {
    throw new Error("KV binding FUND_WATCHER_KV is not configured");
  }

  return env.FUND_WATCHER_KV;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function isValidNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateFund(input: unknown, index: number): BackgroundFundItem | string {
  if (!isPlainObject(input)) {
    return `funds[${index}] must be an object`;
  }

  if (typeof input.code !== "string" || !FUND_CODE_RE.test(input.code)) {
    return `funds[${index}].code must be a 6-digit string`;
  }

  if (typeof input.enabled !== "boolean") {
    return `funds[${index}].enabled must be boolean`;
  }

  if (
    input.thresholdUp !== undefined &&
    !isValidNumber(input.thresholdUp)
  ) {
    return `funds[${index}].thresholdUp must be number`;
  }

  if (
    input.thresholdDown !== undefined &&
    !isValidNumber(input.thresholdDown)
  ) {
    return `funds[${index}].thresholdDown must be number`;
  }

  return {
    code: input.code,
    name: readOptionalString(input.name),
    alias: readOptionalString(input.alias),
    enabled: input.enabled,
    thresholdUp: input.thresholdUp,
    thresholdDown: input.thresholdDown,
  };
}

function validateNotifyConfig(input: unknown): NotifyConfig | string {
  if (!isPlainObject(input)) {
    return "notify must be an object";
  }

  if (!isPlainObject(input.pushplus)) {
    return "notify.pushplus must be an object";
  }

  if ("token" in input.pushplus) {
    return "PushPlus token must not be saved in background config";
  }

  if (typeof input.pushplus.enabled !== "boolean") {
    return "notify.pushplus.enabled must be boolean";
  }

  if (!isPlainObject(input.webPush)) {
    return "notify.webPush must be an object";
  }

  if (typeof input.webPush.enabled !== "boolean") {
    return "notify.webPush.enabled must be boolean";
  }

  const template = input.pushplus.template;
  if (
    template !== undefined &&
    template !== "html" &&
    template !== "txt" &&
    template !== "json"
  ) {
    return "notify.pushplus.template must be html, txt, or json";
  }

  return {
    pushplus: {
      enabled: input.pushplus.enabled,
      template: template ?? "html",
    },
    webPush: {
      enabled: input.webPush.enabled,
    },
  };
}

export function getDefaultBackgroundConfig(): BackgroundMonitorConfig {
  return {
    version: DEFAULT_VERSION,
    enabled: false,
    timezone: DEFAULT_TIMEZONE,
    refreshCron: DEFAULT_REFRESH_CRON,
    funds: [],
    notify: {
      pushplus: {
        enabled: false,
        template: "html",
      },
      webPush: {
        enabled: false,
      },
    },
    updatedAt: 0,
  };
}

export function validateBackgroundConfig(
  input: unknown,
): ValidationResult | ValidationError {
  if (!isPlainObject(input)) {
    return { ok: false, error: "config must be an object" };
  }

  if (typeof input.enabled !== "boolean") {
    return { ok: false, error: "enabled must be boolean" };
  }

  if (!Array.isArray(input.funds)) {
    return { ok: false, error: "funds must be an array" };
  }

  const funds: BackgroundFundItem[] = [];
  for (let index = 0; index < input.funds.length; index += 1) {
    const fund = validateFund(input.funds[index], index);
    if (typeof fund === "string") {
      return { ok: false, error: fund };
    }

    funds.push(fund);
  }

  const notify = validateNotifyConfig(input.notify);
  if (typeof notify === "string") {
    return { ok: false, error: notify };
  }

  return {
    ok: true,
    data: {
      version: readOptionalString(input.version) ?? DEFAULT_VERSION,
      enabled: input.enabled,
      timezone: readOptionalString(input.timezone) ?? DEFAULT_TIMEZONE,
      refreshCron: readOptionalString(input.refreshCron) ?? DEFAULT_REFRESH_CRON,
      funds,
      notify,
      updatedAt: Date.now(),
    },
  };
}

export async function getBackgroundConfig(
  env: Env,
): Promise<BackgroundMonitorConfig> {
  const config = await getKv(env).get<BackgroundMonitorConfig>(
    BACKGROUND_CONFIG_KEY,
    "json",
  );

  return config ?? getDefaultBackgroundConfig();
}

export async function saveBackgroundConfig(
  env: Env,
  config: BackgroundMonitorConfig,
): Promise<BackgroundMonitorConfig> {
  await getKv(env).put(BACKGROUND_CONFIG_KEY, JSON.stringify(config));

  return config;
}
