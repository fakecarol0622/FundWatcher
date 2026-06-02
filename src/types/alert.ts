export type AlertType = "up" | "down";

export interface AlertRecord {
  id: string;
  fundCode: string;
  fundName: string;
  type: AlertType;
  threshold: number;
  actualGrowth: number;
  message: string;
  date: string;
  triggeredAt: number;
}
