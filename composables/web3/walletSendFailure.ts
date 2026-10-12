import { isUserRejectedRequest } from "~/composables/safe/safeTransactionService";
import { useToastStore } from "~/store/toasts/toast.store";
import { networksMap } from "~/store/web3/networksMap";
import type { ChainId } from "~/types/enums/chain_id";

/**
 * A transaction the app hands to the wallet fails in one of three places: the
 * person declines it, the chain rejects it, or the wallet never gets as far
 * as asking, because the RPC node saved in its network settings refused or
 * could not be reached. The third one is the confusing case. The page keeps
 * working, since the app reads the chain through its own RPCs; the wallet's
 * node is only consulted when the wallet receives eth_sendTransaction and
 * prices and simulates it before showing a confirmation, so the button looks
 * broken for no reason and no confirmation ever appears. On 2026-10-12 that
 * cost a day on a vote against a treasury drain: the wallet's
 * Polygon entry still pointed at polygon-rpc.com, which had been answering
 * HTTP 401 for two months, and the toast said "There has been an error".
 *
 * These helpers tell that case apart and say what to change.
 */

/** Everything an error and the errors it wraps say, flattened for matching. */
export const collectErrorText = (error: any, depth = 0): string => {
  if (error == null || depth > 4) return "";
  if (typeof error === "string") return error;
  const parts: string[] = [];
  for (const own of [error.message, error.reason, error.shortMessage]) {
    if (typeof own === "string" && own) parts.push(own);
  }
  for (const key of ["innerError", "cause", "data", "error", "info"]) {
    const nested = error[key];
    if (typeof nested === "string") parts.push(nested);
    else if (nested && typeof nested === "object") parts.push(collectErrorText(nested, depth + 1));
  }
  return parts.filter(Boolean).join(" | ");
};

/** The node said no: bad key, dead tenant, quota, or a plain HTTP refusal. */
const RPC_REFUSED =
  /unauthori[sz]ed|forbidden|\b40[13]\b|api key|tenant disabled|must be authenticated|project ?id|access denied|quota|rate.?limit|too many requests|\b429\b|paid subscription|non-200 status|failed with status/i;

/** The node never answered, or answered with something that is not JSON-RPC. */
const RPC_UNREACHABLE =
  /failed to fetch|fetch failed|network ?error|econnrefused|enotfound|timed? ?out|\b50[234]\b|bad gateway|service unavailable|gateway timeout|could not (detect|connect)|connection (refused|reset|closed)|cors/i;

/**
 * MetaMask reports whatever its node said as this one line. It is also what
 * it says for a revert, so on its own it proves nothing.
 */
const RPC_MASKED = /internal json-rpc error/i;

/**
 * Failures that come from the chain, the wallet's permissions or the network
 * switch, never from the RPC URL. "Unauthorized" is also EIP-1193 code 4100,
 * the wallet refusing the dApp an account, hence the second clause.
 */
const NOT_THE_RPC =
  /revert|insufficient funds|nonce too (low|high)|replacement transaction|underpriced|gas required exceeds|intrinsic gas|out of gas|already known|unrecognized chain|unsupported chain|switchEthereumChain|addEthereumChain|authorized by the user|not been authorized/i;

const NOT_THE_RPC_CODES = new Set([4001, 4100, 4200, 4900, 4901, 4902]);

export interface WalletSendContext {
  chainId: ChainId;
  /**
   * The app's own RPC estimated this very call a moment ago. That rules out a
   * revert and a dead chain, which is what lets the masked case through.
   */
  appRpcOk: boolean;
  walletLabel?: string;
}

/** What the wallet's node said, trimmed to one readable line. */
const reasonFrom = (text: string): string => {
  const first = text.split(" | ")[0].replace(/^Returned error:\s*/i, "").trim();
  return first.length > 120 ? `${first.slice(0, 117)}...` : first;
};

/**
 * The upstream message when a send failed on the wallet's RPC, null when it
 * failed for any other reason (declined, reverted, wrong network, ...).
 */
export const detectWalletRpcFailure = (
  error: any,
  context: Pick<WalletSendContext, "appRpcOk">,
): string | null => {
  if (isUserRejectedRequest(error)) return null;
  const code = Number(error?.code ?? error?.innerError?.code);
  if (NOT_THE_RPC_CODES.has(code)) return null;

  const text = collectErrorText(error);
  if (!text || NOT_THE_RPC.test(text)) return null;
  if (RPC_REFUSED.test(text) || RPC_UNREACHABLE.test(text)) return reasonFrom(text);
  if (RPC_MASKED.test(text) && context.appRpcOk) return reasonFrom(text);
  return null;
};

export const walletRpcFailureMessage = (
  reason: string,
  context: WalletSendContext,
): string => {
  const network = networksMap[context.chainId];
  const chain = network?.chainName ?? `chain ${context.chainId}`;
  const wallet = context.walletLabel || "Your wallet";
  const rpcUrl = network?.walletRpcUrl;
  const fix = rpcUrl
    ? `Open the ${chain} network in ${wallet}'s settings, set its RPC URL to ${rpcUrl}, then try again.`
    : `Open the ${chain} network in ${wallet}'s settings and point its RPC URL at a working node, then try again.`;
  return (
    `${wallet} could not reach ${chain}: its RPC node answered "${reason}". ` +
    `The app itself reaches ${chain}, so the RPC URL saved in the wallet is the likely cause. ${fix}`
  );
};

/** The hint on screen, if any, so a later success can take it down. */
let activeHint: string | undefined;

/**
 * Called by the send path with whatever it caught. Raises a toast that stays
 * until dismissed when the failure is the wallet's RPC; otherwise does
 * nothing, and the caller's own error handling speaks.
 */
export const reportWalletSendFailure = (error: any, context: WalletSendContext): boolean => {
  const reason = detectWalletRpcFailure(error, context);
  if (!reason) return false;

  const message = walletRpcFailureMessage(reason, context);
  activeHint = message;
  useToastStore().errorToast(message, -1);
  return true;
};

/** A send went through, so whatever the hint described is fixed. */
export const clearWalletRpcHint = (): void => {
  if (!activeHint) return;
  const toastStore = useToastStore();
  const toast = toastStore.toasts.find((item) => item.message === activeHint);
  if (toast) toastStore.closeToast(toast.id);
  activeHint = undefined;
};
