import { describe, expect, it } from "vitest";
import {
  countUnread,
  formatRelativeTime,
  notificationIcon,
} from "~/composables/notifications/feed";
import {
  SIGN_IN_STATEMENT,
  buildSignInMessage,
} from "~/composables/notifications/signInMessage";
import type { INotification } from "~/types/notifications";

const notification = (id: number, createdAt: string): INotification => ({
  id,
  kind: "proposal_created",
  chainId: "0x1" as any,
  fundAddress: "0x0000000000000000000000000000000000000001",
  fundName: "Vault",
  fundSymbol: "V",
  title: "t",
  body: "b",
  payload: {},
  path: "/details/x",
  eventAt: 0,
  createdAt,
});

describe("notification sign-in message", () => {
  it("renders exactly what the backend rebuilds and verifies", () => {
    const message = buildSignInMessage(
      "0x1234567890AbcdEF1234567890aBcdef12345678",
      "2026-09-05T10:00:00.000Z",
    );
    expect(message).toBe(
      "Rethink Finance wants you to sign in with your Ethereum account:\n" +
        "0x1234567890AbcdEF1234567890aBcdef12345678\n\n" +
        `${SIGN_IN_STATEMENT}\n\n` +
        "Issued At: 2026-09-05T10:00:00.000Z",
    );
  });
});

describe("notification feed helpers", () => {
  it("counts only what arrived after the panel was last opened", () => {
    const seenAt = Date.parse("2026-09-05T10:00:00.000Z");
    const list = [
      notification(1, "2026-09-05T09:59:59.000Z"),
      notification(2, "2026-09-05T10:00:00.000Z"),
      notification(3, "2026-09-05T10:00:01.000Z"),
    ];
    expect(countUnread(list, seenAt)).toBe(1);
    expect(countUnread(list, 0)).toBe(3);
  });

  it("formats relative time tersely", () => {
    const now = Date.parse("2026-09-05T12:00:00.000Z");
    expect(formatRelativeTime("2026-09-05T11:59:30.000Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-09-05T11:56:00.000Z", now)).toBe("4m");
    expect(formatRelativeTime("2026-09-05T09:00:00.000Z", now)).toBe("3h");
    expect(formatRelativeTime("2026-09-03T12:00:00.000Z", now)).toBe("2d");
    expect(formatRelativeTime("not a date", now)).toBe("");
  });

  it("gives every kind an icon and unknown kinds the bell", () => {
    expect(notificationIcon("deposit_ready")).toContain("arrow-down");
    expect(notificationIcon("something_else")).toBe("mdi-bell-outline");
  });
});
