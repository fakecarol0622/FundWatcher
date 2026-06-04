import { defineStore } from "pinia";
import { defaultSettings, type AppSettings, type AppTheme } from "../types/settings";
import { getItem, setItem, STORAGE_KEYS } from "../services/storageService";

function loadSettings(): AppSettings {
  return {
    ...defaultSettings,
    ...getItem<Partial<AppSettings>>(STORAGE_KEYS.settings, defaultSettings),
  };
}

export const useSettingsStore = defineStore("settings", {
  state: () => loadSettings(),
  actions: {
    updateSettings(patch: Partial<AppSettings>): void {
      Object.assign(this, patch);
      this.saveToStorage();
    },

    setRefreshIntervalMinutes(value: number): void {
      this.refreshIntervalMinutes = value;
      this.saveToStorage();
    },

    setDefaultThresholdUp(value: number): void {
      this.defaultThresholdUp = value;
      this.saveToStorage();
    },

    setDefaultThresholdDown(value: number): void {
      this.defaultThresholdDown = value;
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
