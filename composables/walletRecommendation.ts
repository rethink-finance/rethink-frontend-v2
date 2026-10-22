/**
 * Which wallet the connect modal puts first, and why. Pure, so the order of
 * the rules is pinned by tests rather than by reading the modal.
 */

export interface WalletSignal {
  label: string;
  // A browser extension found in this browser.
  installed: boolean;
  // An account the extension has already approved for this site, read
  // without a prompt (`eth_accounts`).
  authorizedAccount?: string;
  // Connects without anything installed here (WalletConnect, Ledger).
  alwaysAvailable?: boolean;
  // Set on a row that connects through another wallet (Safe and Fireblocks
  // through WalletConnect).
  via?: string;
}

export interface WalletRecommendation {
  label: string;
  reason: string;
}

const short = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

/**
 * `wallets` comes in the modal's order (most used first), which breaks ties.
 *  0. the Safe the app is open inside (Safe's own module, not the row that
 *     reaches a Safe through WalletConnect)
 *  1. installed and already approved for this site, the last-used one first
 *  2. the last-used wallet, if it can still connect
 *  3. the first installed extension
 *  4. WalletConnect, when the browser has no wallet (a phone, a fresh profile)
 */
export function recommendWallet(
  wallets: WalletSignal[],
  lastUsed?: string,
): WalletRecommendation | undefined {
  if (wallets.some((w) => w.label === "Safe" && !w.via)) {
    return { label: "Safe", reason: "This app is open inside your Safe" };
  }

  const approved = wallets.filter((w) => w.installed && w.authorizedAccount);
  const approvedPick = approved.find((w) => w.label === lastUsed) ?? approved[0];
  if (approvedPick) {
    return {
      label: approvedPick.label,
      reason: `Already approved for this site as ${short(approvedPick.authorizedAccount!)}`,
    };
  }

  const last = wallets.find((w) => w.label === lastUsed);
  if (last && (last.installed || last.alwaysAvailable)) {
    return { label: last.label, reason: "The wallet you used last time" };
  }

  const installed = wallets.find((w) => w.installed);
  if (installed) {
    return { label: installed.label, reason: "Installed in this browser" };
  }

  const walletConnect = wallets.find((w) => w.label === "WalletConnect");
  if (walletConnect) {
    return {
      label: walletConnect.label,
      reason: "No browser wallet found. Scan with your phone or desktop app",
    };
  }
  return undefined;
}
