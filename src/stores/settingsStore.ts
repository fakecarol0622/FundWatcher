import { defineStore } from "pinia";
import { defaultSettings, type AppSettings, type AppTheme } from "../types/settings";
import { getItem, setItem, STORAGE_KEYS } from "../services/storageService";

function loadSettings(): AppSettings {
  return {
    ...defaultSettings,
    ...getItem<Partial<AppSettings>>(STORAGE_KEYS.settings, defaultSettings),
  };
}

function sanitizeRefreshInterval(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : defaultSettings.refreshIntervalMinutes;
}

function sanitizeThresholdUp(value: number): number {
  return Number.isFinite(value) ? value : defaultSettings.defaultThresholdUp;
}

function sanitizeThresholdDown(value: number): number {
  return Number.isFinite(value) ? value : defaultSettings.defaultThresholdDown;
}

export const useSettingsStore = defineStore("settings", {
  state: () => loadSettings(),
  actions: {
    updateSettings(patch: Partial<AppSettings>): void {
      Object.assign(this, {
        ...patch,
        refreshIntervalMinutes:
          patch.refreshIntervalMinutes === undefined
            ? this.refreshIntervalMinutes
            : sanitizeRefreshInterval(patch.refreshIntervalMinutes),
        defaultThresholdUp:
          patch.defaultThresholdUp === undefined
            ? this.defaultThresholdUp
            : sanitizeThresholdUp(patch.defaultThresholdUp),
        defaultThresholdDown:
          patch.defaultThresholdDown === undefined
            ? this.defaultThresholdDown
            : sanitizeThresholdDown(patch.defaultThresholdDown),
      });
      this.saveToStorage();
    },

    setRefreshIntervalMinutes(value: number): void {
      this.refreshIntervalMinutes = sanitizeRefreshInterval(value);
      this.saveToStorage();
    },

    setDefaultThresholdUp(value: number): void {
      this.defaultThresholdUp = sanitizeThresholdUp(value);
      this.saveToStorage();
    },

    setDefaultThresholdDown(value: number): void {
      this.defaultThresholdDown = sanitizeThresholdDown(value);
      this.saveToStorage();
    },

    setEnableBrowserNotification(value: boolean): void {
      this.enableBrowserNotification = value;
      this.saveToStorage();
    },

    setTheme(value: AppTheme): void {
      this.theme = value;
      this.saveToStorage();
    },

    loadFromStorage(): void {
      Object.assign(this, loadSettings());
    },

    replaceSettings(settings: AppSettings): void {
      this.refreshIntervalMinutes = sanitizeRefreshInterval(settings.refreshIntervalMinutes);
      this.enableBrowserNotification = settings.enableBrowserNotification;
      this.defaultThresholdUp = sanitizeThresholdUp(settings.defaultThresholdUp);
      this.defaultThresholdDown = sanitizeThresholdDown(settings.defaultThresholdDown);
      this.theme = settings.theme;
      this.saveToStorage();
    },

    resetState(): void {
      this.refreshIntervalMinutes = defaultSettings.refreshIntervalMinutes;
      this.enableBrowserNotification = defaultSettings.enableBrowserNotification;
      this.defaultThresholdUp = defaultSettings.defaultThresholdUp;
      this.defaultThresholdDown = defaultSettings.defaultThresholdDown;
      this.theme = defaultSettings.theme;
      this.saveToStorage();
    },

    saveToStorage(): void {
      const settings: AppSettings = {
        refreshIntervalMinutes: this.refreshIntervalMinutes,
        enableBrowserNotification: this.enableBrowserNotification,
        defaultThresholdUp: this.defaultThresholdUp,
        defaultThresholdDown: this.defaultThresholdDown,
        theme: this.theme,
      };

      setItem(STORAGE_KEYS.settings, settings);
    },
  },
});
