import { RETHINK_HYPERLIQUID_REFERRAL_CODE } from "@rethink-finance/positions-registry";
import { ethers } from "ethers";
import {
  CRT_V2_AGENT_MAX_DAYS,
  CRT_V2_AGENT_MIN_DAYS,
  encodeAddApiWallet,
} from "~/composables/execution/crtV2Vault";
import { postExchangeAction } from "~/composables/hyperevm/bigBlocks";
import { signL1Action } from "~/composables/hyperevm/hyperCoreSigning";
import type { IRoleCall } from "~/composables/permissions/useRoleExecution";

/**
 * A vault's Hyperliquid account, set up from the app: the two steps the
 * registry's HYPERLIQUID.md otherwise leaves to a script (registering an API
 * wallet, setting the RETHINK referral), for any HyperEVM vault whose
 * manager role holds the registry's Hyperliquid permissions.
 *
 * - Registering an API wallet is a HyperEVM transaction: the manager sends
 *   CoreWriter.sendRawAction(addApiWallet(address, name)) through the
 *   vault's Roles modifier, and the registry's `delegate` permission lets
 *   through only the address the vault was launched with (or the zero
 *   address, which empties a slot) — any address for an admin whose role
 *   may rotate API wallets. HyperCore applies it a few seconds after
 *   the block and refuses silently — an account that was never activated,
 *   say — so the result is confirmed on Hyperliquid itself.
 * - The referral has no CoreWriter action. Only a key that acts for the
 *   account can set it, and a Safe has none, so one of the account's API
 *   wallets signs setReferrer: its key is used in this tab and dropped. It
 *   is never stored, and only its signature leaves the page.
 *
 * The CarrotFunding console registers its trading agent the same way
 * (crtV2Console.ts); this is that flow without Carrot's addresses.
 */

export const HYPERLIQUID_INFO_URL = "https://api.hyperliquid.xyz/info";

/** HyperCore's system contract: raw actions for the calling address. */
export const CORE_WRITER = "0x3333333333333333333333333333333333333333";

/** HyperCore's bounds on a named API wallet's validity, in days. */
export const API_WALLET_MIN_DAYS = CRT_V2_AGENT_MIN_DAYS;
export const API_WALLET_MAX_DAYS = CRT_V2_AGENT_MAX_DAYS;

/** Hyperliquid's longest name for an API wallet, before its expiry suffix. */
export const API_WALLET_NAME_MAX = 16;

const DAY_MS = 86_400_000;
const INFO_TIMEOUT_MS = 15_000;

const coreWriter = new ethers.Interface(["function sendRawAction(bytes data)"]);

const isLive = (address: unknown): address is string =>
  typeof address === "string" &&
  ethers.isAddress(address) &&
  address.toLowerCase() !== ethers.ZeroAddress;

const sameAddress = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

/* ---- Names and expiries --------------------------------------------------- */

/** How HyperCore reads a named API wallet's expiry: "<name> valid_until <unix ms>". */
export const apiWalletSlotName = (name: string, validUntilMs: number): string =>
  `${name.trim()} valid_until ${validUntilMs}`;

/** Why `name` cannot name an API wallet, or "" when it can. */
export const apiWalletNameProblem = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) return "Give the API wallet a name.";
  // Before the length: a pasted "<name> valid_until <ms>" is usually too long
  // too, and the expiry is the part to take out.
  if (/valid_until/i.test(trimmed)) {
    return "Leave the expiry out of the name; it is added for you.";
  }
  if (trimmed.length > API_WALLET_NAME_MAX) {
    return `A name is at most ${API_WALLET_NAME_MAX} characters.`;
  }
  return "";
};

/**
 * The expiry a registration of `days` gets. HyperCore accepts at most
 * 180 days from its own clock, which reads the transaction later than this
 * runs, so a full 180 from here always fits.
 */
export const apiWalletValidUntil = (days: number, now = Date.now()): number => {
  if (!Number.isInteger(days) || days < API_WALLET_MIN_DAYS || days > API_WALLET_MAX_DAYS) {
    throw new RangeError(
      `An API wallet is valid for ${API_WALLET_MIN_DAYS} to ${API_WALLET_MAX_DAYS} days.`,
    );
  }
  return now + days * DAY_MS;
};

export const daysLeft = (validUntilMs: number, now = Date.now()): number =>
  Math.max(0, Math.ceil((validUntilMs - now) / DAY_MS));

/* ---- The calls the manager sends through the role ------------------------- */

/** Register `address` as an API wallet of the vault's account, under `name`. */
export const registerApiWalletCall = (
  address: string,
  name: string,
  validUntilMs: number,
): IRoleCall => ({
  to: CORE_WRITER,
  data: coreWriter.encodeFunctionData("sendRawAction", [
    encodeAddApiWallet(ethers.getAddress(address), apiWalletSlotName(name, validUntilMs)),
  ]),
});

/** Empty the slot `name` holds: Hyperliquid's removal is the zero address under that name. */
export const removeApiWalletCall = (name: string): IRoleCall => ({
  to: CORE_WRITER,
  data: coreWriter.encodeFunctionData("sendRawAction", [
    encodeAddApiWallet(ethers.ZeroAddress, name),
  ]),
});

/* ---- Reads ---------------------------------------------------------------- */

/** One request to Hyperliquid's info API. */
export const hyperliquidInfo = async <T>(
  body: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<T> => {
  const response = await fetchImpl(HYPERLIQUID_INFO_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(INFO_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Hyperliquid's info API answered ${response.status}.`);
  return (await response.json()) as T;
};

export interface IHyperliquidAccount {
  /**
   * HyperCore knows the account. A new account is activated by receiving a
   * transfer on Hyperliquid (it pays a 1 USDC fee); until then CoreWriter
   * actions for it are dropped.
   */
  activated: boolean;
  spotUsdc: number;
  perpValue: number;
}

/**
 * The vault Safe's account on Hyperliquid. "missing" from userRole is how
 * HyperCore answers an address it has never seen (checked 2026-10-22: a
 * fresh key reads "missing", funded accounts "user", agreeing with the
 * coreUserExists precompile).
 */
export const fetchHyperliquidAccount = async (
  safe: string,
  fetchImpl?: typeof fetch,
): Promise<IHyperliquidAccount> => {
  const { role } = await hyperliquidInfo<{ role?: string }>({ type: "userRole", user: safe }, fetchImpl);
  if (role === "missing") return { activated: false, spotUsdc: 0, perpValue: 0 };
  const [spot, perp] = await Promise.all([
    hyperliquidInfo<{ balances?: { coin: string; total: string }[] }>(
      { type: "spotClearinghouseState", user: safe },
      fetchImpl,
    ),
    hyperliquidInfo<{ marginSummary?: { accountValue?: string } }>(
      { type: "clearinghouseState", user: safe },
      fetchImpl,
    ),
  ]);
  const usdc = (spot.balances ?? []).find((balance) => balance.coin === "USDC");
  return {
    activated: true,
    spotUsdc: Number(usdc?.total ?? 0),
    perpValue: Number(perp.marginSummary?.accountValue ?? 0),
  };
};

export interface IApiWalletSlot {
  name: string;
  address: string;
  validUntil: number | null;
}

/**
 * The account's named API wallets, each with its expiry. (The unnamed slot,
 * the one Hyperliquid's own app fills for a personal account, is only in
 * the 300 kB webData2 answer; registrations from here are always named.)
 */
export const fetchApiWallets = async (
  safe: string,
  fetchImpl?: typeof fetch,
): Promise<IApiWalletSlot[]> => {
  const slots = await hyperliquidInfo<unknown>({ type: "extraAgents", user: safe }, fetchImpl);
  return (Array.isArray(slots) ? slots : [])
    .filter((slot) => isLive(slot?.address))
    .map((slot) => ({
      name: String(slot.name ?? ""),
      address: ethers.getAddress(slot.address),
      validUntil: Number(slot.validUntil) || null,
    }));
};

/** The account `address` acts for as an API wallet, or null when it acts for none. */
export const fetchApiWalletOwner = async (
  address: string,
  fetchImpl?: typeof fetch,
): Promise<string | null> => {
  const answer = await hyperliquidInfo<{ role?: string; data?: { user?: string } }>(
    { type: "userRole", user: address },
    fetchImpl,
  );
  const user = answer.data?.user;
  return answer.role === "agent" && isLive(user) ? ethers.getAddress(user) : null;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait for HyperCore to list `address` as an API wallet of `safe` — or,
 * with `listed: false`, to stop listing it. False when that has not
 * happened within the time given: HyperCore drops a refused CoreWriter
 * action without a word.
 */
export const waitForApiWallet = async (
  address: string,
  safe: string,
  {
    listed = true,
    timeoutMs = 30_000,
    intervalMs = 2_000,
    fetchImpl,
  }: { listed?: boolean; timeoutMs?: number; intervalMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const owner = await fetchApiWalletOwner(address, fetchImpl);
      if (sameAddress(owner, safe) === listed) return true;
    } catch (error) {
      console.warn("Could not read the API wallet's role", error);
    }
    if (Date.now() >= deadline) return false;
    await sleep(intervalMs);
  }
};

export interface IReferralState {
  /** The code the account was referred with, or null when none was set. */
  code: string | null;
  isRethink: boolean;
}

export const fetchReferral = async (
  safe: string,
  fetchImpl?: typeof fetch,
): Promise<IReferralState> => {
  const answer = await hyperliquidInfo<{ referredBy?: { code?: string } | null }>(
    { type: "referral", user: safe },
    fetchImpl,
  );
  const code = answer.referredBy?.code ?? null;
  return { code, isRethink: code === RETHINK_HYPERLIQUID_REFERRAL_CODE };
};

/* ---- The referral --------------------------------------------------------- */

export const setReferrerAction = (code: string) => ({ type: "setReferrer", code });

/** The wallet behind a pasted private key, with or without its 0x. */
export const walletFromPrivateKey = (privateKey: string): ethers.Wallet => {
  const hex = privateKey.trim();
  const key = /^[0-9a-fA-F]{64}$/.test(hex) ? `0x${hex}` : hex;
  const notAKey = new Error(
    "That is not a private key: it is 64 hexadecimal characters, with or without 0x.",
  );
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) throw notAKey;
  try {
    return new ethers.Wallet(key);
  } catch {
    // Right length, but outside the curve's range (all zeros, say).
    throw notAKey;
  }
};

/**
 * Set the RETHINK referral for `safe`'s account with the key of one of its
 * API wallets. The key is checked against Hyperliquid first: signed by a
 * key that acts for another account, the code would land there instead.
 * Nothing about the key leaves this function except the signature.
 */
export const setRethinkReferral = async (
  privateKey: string,
  safe: string,
  fetchImpl?: typeof fetch,
): Promise<void> => {
  const wallet = walletFromPrivateKey(privateKey);
  const owner = await fetchApiWalletOwner(wallet.address, fetchImpl);
  if (!sameAddress(owner, safe)) {
    throw new Error(
      owner
        ? `That key is an API wallet of another account (${owner}), not of this vault.`
        : `That key (${wallet.address}) is not an API wallet of this vault's ` +
          "Hyperliquid account. Register it above first, and allow a few seconds.",
    );
  }
  const nonce = Date.now();
  const action = setReferrerAction(RETHINK_HYPERLIQUID_REFERRAL_CODE);
  await postExchangeAction(action, nonce, await signL1Action(wallet, action, nonce), fetchImpl);
};
