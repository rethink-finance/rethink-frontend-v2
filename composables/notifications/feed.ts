import type { INotification, NotificationKind } from "~/types/notifications";

/** Notifications newer than the moment the panel was last opened. */
export const countUnread = (
  notifications: INotification[],
  seenAt: number,
): number =>
  notifications.filter((notification) => isUnread(notification, seenAt)).length;

export const isUnread = (notification: INotification, seenAt: number): boolean =>
  Date.parse(notification.createdAt) > seenAt;

/** The icon each kind wears in the panel (Vuetify mdi font names). */
export const notificationIcon = (kind: NotificationKind | string): string => {
  switch (kind) {
    case "proposal_created":
      return "mdi-vote-outline";
    case "deposit_ready":
      return "mdi-arrow-down-circle-outline";
    case "redemption_ready":
      return "mdi-arrow-up-circle-outline";
    default:
      return "mdi-bell-outline";
  }
};

/**
 * "just now", "4m", "3h", "2d", then a short date. Terse on purpose: it sits
 * in a meta row next to the vault name.
 */
export const formatRelativeTime = (isoOrMs: string | number, now = Date.now()): string => {
  const time = typeof isoOrMs === "number" ? isoOrMs : Date.parse(isoOrMs);
  if (Number.isNaN(time)) return "";
  const seconds = Math.max(0, Math.floor((now - time) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(time).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};
