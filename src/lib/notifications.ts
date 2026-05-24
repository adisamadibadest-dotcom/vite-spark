export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return await Notification.requestPermission();
}

export function fireAlertNotification(
  direction: "above" | "below",
  alertPrice: number,
  currentPrice: number,
  note?: string | null
): void {
  if (!notificationsSupported() || Notification.permission !== "granted") return;

  const arrow = direction === "above" ? "📈" : "📉";
  const label = direction === "above" ? "above" : "below";
  const title = `${arrow} XAUUSD Alert Triggered`;
  const body = [
    `Price ${label} $${alertPrice.toFixed(2)} hit — now $${currentPrice.toFixed(2)}`,
    note ? `Note: ${note}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const n = new Notification(title, {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: `xauusd-alert-${alertPrice}`,
      requireInteraction: false,
    });
    setTimeout(() => n.close(), 8000);
  } catch {
    // Notifications blocked or unavailable — silent fail
  }
}
