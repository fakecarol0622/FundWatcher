export type AppTheme = "light" | "dark" | "system";

export interface AppSettings {
  refreshIntervalMinutes: number;
  enableBrowserNotification: boolean;
  defaultThresholdUp: number;
  defaultThresholdDown: number;
  theme: AppTheme;
}

export const defaultSettings: AppSettings = {
  refreshIntervalMinutes: 30,
  enableBrowserNotification: false,
  defaultThresholdUp: 3,
  defaultThresholdDown: -3,
  theme: "system",
};
