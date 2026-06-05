import type { AlertRecord } from "./alert";
import type { FundItem } from "./fund";
import type { Holding } from "./holding";
import type { AppSettings } from "./settings";

export interface BackupData {
  version: string;
  exportedAt: number;
  funds: FundItem[];
  holdings: Holding[];
  alerts: AlertRecord[];
  settings: AppSettings;
}
