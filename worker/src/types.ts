export interface BackgroundFundItem {
  code: string;
  name?: string;
  alias?: string;
  enabled: boolean;
  thresholdUp?: number;
  thresholdDown?: number;
}

export interface NotifyConfig {
  pushplus: {
    enabled: boolean;
    template: "html" | "txt" | "json";
  };
  webPush: {
    enabled: boolean;
  };
}

export interface BackgroundMonitorConfig {
  version: string;
  enabled: boolean;
  timezone: string;
  refreshCron: string;
  funds: BackgroundFundItem[];
  notify: NotifyConfig;
  updatedAt: number;
}

export interface Env {
  ALLOWED_ORIGIN?: string;
  FUND_WATCHER_KV?: KVNamespace;
}
