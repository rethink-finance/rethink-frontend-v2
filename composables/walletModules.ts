import type { init } from "@web3-onboard/vue";
import { ref } from "vue";

type WalletInit = Parameters<typeof init>[0]["wallets"][number];

/**
 * Web3-Onboard connects a wallet in two steps: `getInterface` loads its
 * provider, then the provider is asked for accounts. The app's connect modal
 * runs Web3-Onboard with its own modals off, and in that mode a failed first
 * step (Enkrypt not installed, Ledger's kit blocked) is swallowed and the
 * connect call never settles, which also wedges every later attempt.
 *
 * So each wallet's `getInterface` is wrapped: a failure is recorded under the
 * wallet's label for the modal to show, and Web3-Onboard gets a provider that
 * declines the account request, which it unwinds like a user rejection.
 */
const interfaceErrors = new Map<string, string>();

const DECLINING_PROVIDER = {
  request: () => Promise.reject(
    Object.assign(new Error("Wallet unavailable"), { code: 4001 }),
  ),
  on: () => {},
  removeListener: () => {},
};

/**
 * `extension` marks the modules that are browser extensions, so the modal
 * knows which ones it can ask, without a prompt, whether they are installed.
 */
export function withInterfaceErrors(
  walletInit: WalletInit,
  { extension = false }: { extension?: boolean } = {},
): WalletInit {
  return (helpers) => {
    const wrap = (module: any) => module && {
      ...module,
      isExtension: extension,
      getInterface: async (...args: any[]) => {
        try {
          return await module.getInterface(...args);
        } catch (error: any) {
          interfaceErrors.set(module.label, String(error?.message ?? error));
          return { provider: DECLINING_PROVIDER };
        }
      },
    };
    const modules = walletInit(helpers) as any;
    return Array.isArray(modules) ? modules.map(wrap) : wrap(modules);
  };
}

/** The load failure of the last attempt on this wallet, cleared by reading. */
export function takeInterfaceError(label: string): string | undefined {
  const message = interfaceErrors.get(label);
  interfaceErrors.delete(label);
  return message;
}

/**
 * Web3-Onboard runs one connect at a time and cannot be told to drop one: a
 * second call while one is open waits behind it. So every connect goes
 * through here (the modal's picks and the reconnect on load), and an open one
 * is rejoined by label rather than doubled.
 */
type ConnectOptions = { autoSelect: { label: string; disableModals: boolean } };

let pendingConnect: Promise<void> | undefined;
export const pendingConnectLabel = ref<string>();

export function connectByLabel(
  connect: (options: ConnectOptions) => Promise<unknown>,
  label: string,
): Promise<void> {
  if (pendingConnect && pendingConnectLabel.value === label) return pendingConnect;
  if (pendingConnect) return Promise.reject(new Error(`${pendingConnectLabel.value} is still connecting`));

  pendingConnectLabel.value = label;
  pendingConnect = connect({ autoSelect: { label, disableModals: true } })
    .then(() => {})
    .catch((error) => console.error("Error connecting wallet:", error))
    .finally(() => {
      pendingConnect = undefined;
      pendingConnectLabel.value = undefined;
    });
  return pendingConnect;
}

// Where Web3-Onboard remembers the wallets it reconnects on load, newest first.
export const LAST_CONNECTED_WALLET_KEY = "onboard.js:last_connected_wallet";

export function readLastConnectedWallet(): string | undefined {
  try {
    const stored = localStorage.getItem(LAST_CONNECTED_WALLET_KEY);
    if (!stored) return undefined;
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed[0] : parsed;
    } catch {
      // Older Web3-Onboard versions stored the bare label.
      return stored;
    }
  } catch {
    return undefined;
  }
}

/**
 * A wallet icon's inline SVG markup, or undefined when the icon is a URL.
 * Many bundled icons open with an XML prolog or a DOCTYPE before `<svg`
 * (MetaMask, Safeheron, OneKey...), so "starts with <svg" misses them; the
 * markup is cut from its `<svg` on.
 */
export function svgMarkup(icon: string): string | undefined {
  const start = icon.search(/<svg[\s>]/i);
  return start === -1 ? undefined : icon.slice(start).replace(/\n+/g, " ").trim();
}
