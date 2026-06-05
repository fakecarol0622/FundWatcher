import { defineStore } from "pinia";
import type { AlertRecord, AlertType } from "../types/alert";
import { getItem, setItem, STORAGE_KEYS } from "../services/storageService";
import { getDateString } from "../services/timeService";

type AlertRecordInput = Omit<AlertRecord, "id" | "triggeredAt"> &
  Partial<Pick<AlertRecord, "id" | "triggeredAt">>;

export function buildAlertRecordKey(
  fundCode: string,
  type: AlertType,
  threshold: number,
  date: string,
): string {
  return `${fundCode}:${type}:${threshold}:${date}`;
}

function createAlertId(record: AlertRecordInput): string {
  return buildAlertRecordKey(record.fundCode, record.type, record.threshold, record.date);
}

export const useAlertStore = defineStore("alert", {
  state: () => ({
    alertRecords: getItem<AlertRecord[]>(STORAGE_KEYS.alerts, []),
  }),
  actions: {
    addAlertRecord(input: AlertRecordInput): AlertRecord {
      const record: AlertRecord = {
        ...input,
        id: input.id ?? createAlertId(input),
        triggeredAt: input.triggeredAt ?? Date.now(),
      };

      this.alertRecords.unshift(record);
      this.saveToStorage();
      return record;
    },

    clearAlerts(): void {
      this.alertRecords = [];
      this.saveToStorage();
    },

    hasAlertedToday(
      fundCode: string,
      type: AlertType,
      threshold: number,
      date = getDateString(),
    ): boolean {
      const alertKey = buildAlertRecordKey(fundCode, type, threshold, date);
      return this.alertRecords.some((record) => record.id === alertKey);
    },

    loadFromStorage(): void {
      this.alertRecords = getItem<AlertRecord[]>(STORAGE_KEYS.alerts, []);
    },

    replaceAlerts(alerts: AlertRecord[]): void {
      this.alertRecords = [...alerts].sort((left, right) => right.triggeredAt - left.triggeredAt);
      this.saveToStorage();
    },

    resetState(): void {
      this.alertRecords = [];
      this.saveToStorage();
    },

    saveToStorage(): void {
      setItem(STORAGE_KEYS.alerts, this.alertRecords);
    },
  },
});
