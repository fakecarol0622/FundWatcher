import { ElNotification } from "element-plus";

export type BrowserNotificationPermissionState =
  | NotificationPermission
  | "unsupported";

export interface NotificationPayload {
  title: string;
  body: string;
  tag?: string;
}

export interface BrowserNotificationResult {
  delivered: boolean;
  permission: BrowserNotificationPermissionState;
  reason?: "unsupported" | "disabled" | "denied" | "not-granted";
}

function getNotificationApi(): typeof Notification | null {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return null;
  }

  return window.Notification;
}

export function isBrowserNotificationSupported(): boolean {
  return getNotificationApi() !== null;
}

export function getBrowserNotificationPermission(): BrowserNotificationPermissionState {
  const notificationApi = getNotificationApi();
  return notificationApi ? notificationApi.permission : "unsupported";
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermissionState> {
  const notificationApi = getNotificationApi();
  if (!notificationApi) {
    return "unsupported";
  }

  return notificationApi.requestPermission();
}

export function showToastNotification(payload: NotificationPayload): void {
  ElNotification({
    title: payload.title,
    message: payload.body,
    type: "warning",
    duration: 5000,
  });
}

export function showBrowserNotification(
  payload: NotificationPayload,
  enabled: boolean,
): BrowserNotificationResult {
  const notificationApi = getNotificationApi();

  if (!notificationApi) {
    return {
      delivered: false,
      permission: "unsupported",
      reason: "unsupported",
    };
  }

  const permission = notificationApi.permission;
  if (!enabled) {
    return {
      delivered: false,
      permission,
      reason: "disabled",
    };
  }

  if (permission === "denied") {
    return {
      delivered: false,
      permission,
      reason: "denied",
    };
  }

  if (permission !== "granted") {
    return {
      delivered: false,
      permission,
      reason: "not-granted",
    };
  }

  new notificationApi(payload.title, {
    body: payload.body,
    tag: payload.tag,
  });

  return {
    delivered: true,
    permission,
  };
}
