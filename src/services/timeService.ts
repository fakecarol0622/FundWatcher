export function isAStockTradingTime(now = new Date()): boolean {
  const day = now.getDay();
  if (day === 0 || day === 6) {
    return false;
  }

  const minutes = now.getHours() * 60 + now.getMinutes();
  const morningOpen = 9 * 60 + 30;
  const morningClose = 11 * 60 + 30;
  const afternoonOpen = 13 * 60;
  const afternoonClose = 15 * 60;

  return (
    (minutes >= morningOpen && minutes <= morningClose) ||
    (minutes >= afternoonOpen && minutes <= afternoonClose)
  );
}

export function getDateString(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateTime(timestamp: number | null | undefined): string {
  if (!timestamp) {
    return "--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}
