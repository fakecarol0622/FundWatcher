import { defineStore } from "pinia";
import type { AlertRecord, AlertType } from "../types/alert";
import { getItem, setItem, STORAGE_KEYS } from "../services/storageService";

type AlertRecordInput = Omit<AlertRecord, "id" | "triggeredAt"> &
  Partial<Pick<AlertRecord, "id" | "triggeredAt">>;

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createAlertId(record: AlertRecordInput): string {
  return `${record.fundCode}-${record.type}-${record.threshold}-${record.date}`;
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
      date = getTodayString(),
    ): boolean {
      return this.alertRecords.some(
        (record) =>
          record.fundCode === fundCode &&
          record.type === type &&
          record.threshold === threshold &&
          record.date === date,
      );
    },

    loadFromStorage(): void {
      this.alertRecords = getItem<AlertRecord[]>(STORAGE_KEYS.alerts, []);
    },

    saveToStorage(): void {
      setItem(STORAGE_KEYS.alerts, this.alertRecords);
    },
  },
});
