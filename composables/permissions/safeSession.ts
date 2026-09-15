/**
 * Telling a Safe session apart from a curator's wallet.
 *
 * Kept free of store imports so the rule can be unit-tested on its own; the
 * stores feed it in composables/permissions/useCuratorExecution.ts.
 */

/**
 * Is `account` the vault's custody Safe?
 *
 * That is what a Zodiac Pilot session looks like from inside the app: Pilot
 * injects a provider whose account is the Safe, records every transaction a
 * page sends from it, and replays the batch through the Roles modifier (or
 * as a Safe transaction) from the pilot's own wallet on submit. A Safe
 * paired straight from Safe{Wallet} over WalletConnect presents the same
 * way. Either way the app must not wrap the call in execTransactionWithRole:
 * the Safe holds no role on its own modifier, so a wrapped call would fail
 * NoMembership, and the Safe already has the authority the wrapping borrows.
 */
export const isSafeSession = (
  safeAddress: string | null | undefined,
  account: string | null | undefined,
): boolean => {
  if (!safeAddress || !account) return false;
  return safeAddress.toLowerCase() === account.toLowerCase();
};

/** How an execution button would act if pressed right now. */
export type CuratorExecutionMode = "safe" | "curator" | "none";

/**
 * A Safe session takes the unwrapped path before anything else is asked:
 * membership is never even read for it, so a Safe that somehow also held a
 * role would still send as itself. Everyone else needs a role.
 */
export const resolveExecutionMode = (
  isConnected: boolean,
  isSafe: boolean,
  isCurator: boolean,
): CuratorExecutionMode => {
  if (!isConnected) return "none";
  if (isSafe) return "safe";
  return isCurator ? "curator" : "none";
};

/**
 * What each mode does, in the words the buttons show on hover. Managers who
 * use Pilot on other frontends asked how this app decides — so it says.
 */
export const EXECUTION_MODE_HINTS: Record<
  Exclude<CuratorExecutionMode, "none">,
  string
> = {
  safe:
    "Connected as the custody Safe: transactions are sent from the Safe " +
    "itself, the way a Zodiac Pilot session records them.",
  curator:
    "Connected as a vault curator: your wallet signs, and the vault's Roles " +
    "modifier forwards the call as the Safe.",
};
