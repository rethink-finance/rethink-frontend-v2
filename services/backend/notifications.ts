import type {
  INotification,
  INotificationSession,
  INotificationSettings,
  ITelegramLink,
} from "~/types/notifications";

/**
 * The backend's notification endpoints.
 *
 * The feed soft-fails to null: the bell is a convenience on top of every
 * page, and a backend that is down or not deployed yet must cost an empty
 * panel, never an error in the navbar. The settings calls throw instead —
 * the person just pressed Save and needs to know it did not.
 */

const baseUrl = () => String(useRuntimeConfig().public.BACKEND_URL ?? "");

export const fetchNotificationFeed = async (
  address: string,
  limit = 50,
): Promise<INotification[] | null> => {
  try {
    const response = await fetch(
      `${baseUrl()}/notifications/feed/${address}?limit=${limit}`,
    );
    if (!response.ok) return null;
    const data = await response.json();
    return Array.isArray(data?.notifications) ? data.notifications : [];
  } catch (error) {
    console.warn("[BACKEND] notification feed unavailable:", error);
    return null;
  }
};

const request = async <T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> => {
  const { token, ...rest } = init;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((rest.headers as Record<string, string>) ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${baseUrl()}${path}`, { ...rest, headers });
  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(", ")
      : data?.message || data?.error || `Request failed (${response.status})`;
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return data as T;
};

export const signInForNotifications = (body: {
  address: string;
  issuedAt: string;
  signature: string;
}): Promise<INotificationSession & { address: string }> =>
  request("/notifications/auth", { method: "POST", body: JSON.stringify(body) });

export const fetchNotificationSettings = (
  token: string,
): Promise<INotificationSettings> => request("/notifications/settings", { token });

export const updateNotificationSettings = (
  token: string,
  patch: Partial<
    Pick<INotificationSettings, "emailEnabled" | "telegramEnabled" | "kinds">
  > & { email?: string | null },
): Promise<INotificationSettings & { verificationSent: boolean }> =>
  request("/notifications/settings", {
    method: "PUT",
    token,
    body: JSON.stringify(patch),
  });

export const resendNotificationEmailVerification = (
  token: string,
): Promise<{ sent: boolean }> =>
  request("/notifications/email/resend", { method: "POST", token });

export const createTelegramLink = (token: string): Promise<ITelegramLink> =>
  request("/notifications/telegram/link", { method: "POST", token });

export const unlinkTelegram = (token: string): Promise<INotificationSettings> =>
  request("/notifications/telegram", { method: "DELETE", token });
