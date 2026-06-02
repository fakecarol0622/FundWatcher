const STORAGE_PREFIX = "fund-watcher";

export const STORAGE_KEYS = {
  funds: `${STORAGE_PREFIX}:funds`,
  holdings: `${STORAGE_PREFIX}:holdings`,
  alerts: `${STORAGE_PREFIX}:alerts`,
  settings: `${STORAGE_PREFIX}:settings`,
  fundEstimatesCache: `${STORAGE_PREFIX}:cache:fund-estimates`,
  indexQuotesCache: `${STORAGE_PREFIX}:cache:index-quotes`,
} as const;

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch (error) {
    console.error("[storageService] localStorage is unavailable.", error);
    return null;
  }
}

function buildPrefixedKey(key: string): string {
  return key.startsWith(`${STORAGE_PREFIX}:`) ? key : `${STORAGE_PREFIX}:${key}`;
}

export function getItem<T>(key: string, fallback: T): T {
  const storage = getStorage();
  if (!storage) {
    return fallback;
  }

  try {
    const rawValue = storage.getItem(buildPrefixedKey(key));
    if (!rawValue) {
      return fallback;
    }

    return JSON.parse(rawValue) as T;
  } catch (error) {
    console.error(`[storageService] Failed to parse key "${key}".`, error);
    return fallback;
  }
}

export function setItem<T>(key: string, value: T): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(buildPrefixedKey(key), JSON.stringify(value));
  } catch (error) {
    console.error(`[storageService] Failed to write key "${key}".`, error);
  }
}

export function removeItem(key: string): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(buildPrefixedKey(key));
  } catch (error) {
    console.error(`[storageService] Failed to remove key "${key}".`, error);
  }
}

export function clearAppData(): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    const prefix = `${STORAGE_PREFIX}:`;
    const keysToRemove: string[] = [];

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => storage.removeItem(key));
  } catch (error) {
    console.error("[storageService] Failed to clear app data.", error);
  }
}
