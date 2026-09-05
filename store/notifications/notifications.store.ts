import { ethers } from "ethers";
import { defineStore } from "pinia";
import { useAccountStore } from "~/store/account/account.store";
import {
  createTelegramLink,
  fetchNotificationFeed,
  fetchNotificationSettings,
  resendNotificationEmailVerification,
  signInForNotifications,
  unlinkTelegram,
  updateNotificationSettings,
} from "~/services/backend/notifications";
import { countUnread } from "~/composables/notifications/feed";
import { buildSignInMessage } from "~/composables/notifications/signInMessage";
import type {
  INotification,
  INotificationSession,
  INotificationSettings,
  ITelegramLink,
} from "~/types/notifications";

/**
 * The bell's data: what the backend has for the connected wallet, when the
 * panel was last opened (the badge counts what arrived since), and the
 * wallet-signed session the delivery settings are saved through.
 *
 * Everything is keyed by wallet. Switching accounts swaps the feed, the seen
 * marker and the session together, so one wallet's badge never shows on
 * another's bell.
 */

const POLL_INTERVAL_MS = 60_000;

const seenKey = (address: string) => `notifications.seenAt.${address}`;
const sessionKey = (address: string) => `notifications.session.${address}`;

interface IState {
  /** Lowercase; empty while no wallet is connected. */
  address: string;
  notifications: INotification[];
  isLoading: boolean;
  hasLoaded: boolean;
  /** False once the backend failed to answer — the panel says so instead of "nothing yet". */
  isAvailable: boolean;
  /** Ms. Notifications created after this count as unread. */
  seenAt: number;
  session: INotificationSession | null;
  isSigningIn: boolean;
  settings: INotificationSettings | null;
  isLoadingSettings: boolean;
  isSavingSettings: boolean;
  telegramLink: ITelegramLink | null;
}

let pollTimer: ReturnType<typeof setInterval> | undefined;
let onVisible: (() => void) | undefined;

export const useNotificationsStore = defineStore("notifications", {
  state: (): IState => ({
    address: "",
    notifications: [],
    isLoading: false,
    hasLoaded: false,
    isAvailable: true,
    seenAt: 0,
    session: null,
    isSigningIn: false,
    settings: null,
    isLoadingSettings: false,
    isSavingSettings: false,
    telegramLink: null,
  }),
  getters: {
    unreadCount(): number {
      return countUnread(this.notifications, this.seenAt);
    },
    hasSession(): boolean {
      return !!this.session && Date.parse(this.session.expiresAt) > Date.now();
    },
  },
  actions: {
    /** Called whenever the connected wallet changes, including to nothing. */
    setAccount(address?: string) {
      const next = (address ?? "").toLowerCase();
      if (next === this.address) return;
      this.address = next;
      this.notifications = [];
      this.hasLoaded = false;
      this.isAvailable = true;
      this.settings = null;
      this.telegramLink = null;
      this.seenAt = next ? Number(getLocalStorageItem(seenKey(next), 0)) || 0 : 0;
      this.session = next ? getLocalStorageItem(sessionKey(next), null) : null;
      if (next) this.fetchFeed();
    },

    async fetchFeed() {
      const address = this.address;
      if (!address) return;
      this.isLoading = !this.hasLoaded;
      const list = await fetchNotificationFeed(address);
      // The wallet may have changed while the request was out.
      if (address !== this.address) return;
      if (list === null) {
        this.isAvailable = false;
      } else {
        this.isAvailable = true;
        this.notifications = list;
      }
      this.isLoading = false;
      this.hasLoaded = true;
    },

    markAllSeen() {
      if (!this.address) return;
      this.seenAt = Date.now();
      setLocalStorageItem(seenKey(this.address), this.seenAt);
    },

    startPolling() {
      this.stopPolling();
      pollTimer = setInterval(() => {
        if (document.visibilityState === "visible") this.fetchFeed();
      }, POLL_INTERVAL_MS);
      onVisible = () => {
        if (document.visibilityState === "visible") this.fetchFeed();
      };
      document.addEventListener("visibilitychange", onVisible);
    },

    stopPolling() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = undefined;
      if (onVisible) document.removeEventListener("visibilitychange", onVisible);
      onVisible = undefined;
    },

    // ---- Settings session -------------------------------------------------

    /**
     * A wallet signature, once a week. The message is plain text (EIP-191) and
     * costs nothing; the backend recovers the signer and hands back a token
     * the settings calls carry from then on.
     */
    async ensureSession(): Promise<string> {
      if (this.hasSession && this.session) return this.session.token;

      const accountStore = useAccountStore();
      const provider = accountStore.connectedWallet?.provider;
      const rawAddress = accountStore.activeAccountAddress;
      if (!provider || !rawAddress) throw new Error("Connect a wallet first");
      const address = ethers.getAddress(rawAddress);
      if (address.toLowerCase() !== this.address) this.setAccount(address);

      const issuedAt = new Date().toISOString();
      const message = buildSignInMessage(address, issuedAt);
      this.isSigningIn = true;
      try {
        const signature = (await provider.request({
          method: "personal_sign",
          params: [ethers.hexlify(ethers.toUtf8Bytes(message)), address],
        })) as string;
        const result = await signInForNotifications({ address, issuedAt, signature });
        this.session = { token: result.token, expiresAt: result.expiresAt };
        setLocalStorageItem(sessionKey(this.address), this.session);
        return result.token;
      } finally {
        this.isSigningIn = false;
      }
    },

    clearSession() {
      this.session = null;
      this.settings = null;
      if (this.address) clearLocalStorageItem(sessionKey(this.address));
    },

    async withSession<T>(call: (token: string) => Promise<T>): Promise<T> {
      const token = await this.ensureSession();
      try {
        return await call(token);
      } catch (error: any) {
        // A rejected token (expired, or a backend restarted without a fixed
        // secret) means "sign again", not "try again".
        if (error?.status === 401) this.clearSession();
        throw error;
      }
    },

    async loadSettings() {
      this.isLoadingSettings = true;
      try {
        this.settings = await this.withSession(fetchNotificationSettings);
      } finally {
        this.isLoadingSettings = false;
      }
    },

    /** Quiet refresh — used while waiting for a Telegram link to complete. */
    async refreshSettings() {
      if (!this.hasSession) return;
      try {
        this.settings = await this.withSession(fetchNotificationSettings);
      } catch (error) {
        console.warn("Notification settings refresh failed", error);
      }
    },

    async saveSettings(
      patch: Parameters<typeof updateNotificationSettings>[1],
    ): Promise<boolean> {
      this.isSavingSettings = true;
      try {
        const { verificationSent, ...settings } = await this.withSession((token) =>
          updateNotificationSettings(token, patch),
        );
        this.settings = settings;
        return verificationSent;
      } finally {
        this.isSavingSettings = false;
      }
    },

    async resendVerification(): Promise<boolean> {
      const { sent } = await this.withSession(resendNotificationEmailVerification);
      return sent;
    },

    async startTelegramLink() {
      this.telegramLink = await this.withSession(createTelegramLink);
    },

    async unlinkTelegram() {
      this.settings = await this.withSession(unlinkTelegram);
      this.telegramLink = null;
    },
  },
});
