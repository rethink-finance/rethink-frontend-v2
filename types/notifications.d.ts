import type { ChainId } from "~/types/enums/chain_id";

/** Mirrors the backend's notification-kinds registry. */
export type NotificationKind =
  | "proposal_created"
  | "deposit_ready"
  | "redemption_ready";

export interface INotification {
  id: number;
  kind: NotificationKind;
  chainId: ChainId;
  fundAddress: string;
  fundName: string;
  fundSymbol: string;
  title: string;
  body: string;
  payload: Record<string, any>;
  /** App-relative path the notification opens. */
  path: string;
  /** Seconds. */
  eventAt: number;
  /** ISO string. */
  createdAt: string;
}

export interface INotificationKindInfo {
  kind: NotificationKind;
  label: string;
  description: string;
}

export interface INotificationSettings {
  address: string;
  email: string | null;
  emailVerified: boolean;
  emailEnabled: boolean;
  emailDeliveryAvailable: boolean;
  telegramLinked: boolean;
  telegramUsername: string | null;
  telegramEnabled: boolean;
  telegramDeliveryAvailable: boolean;
  botUsername: string;
  kinds: NotificationKind[];
  availableKinds: INotificationKindInfo[];
}

export interface INotificationSession {
  token: string;
  /** ISO string. */
  expiresAt: string;
}

export interface ITelegramLink {
  code: string;
  deepLink: string;
  botUsername: string;
  expiresAt: string;
}
