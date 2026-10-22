<template>
  <v-dialog
    :model-value="isVisible"
    max-width="440px"
    @update:model-value="(open: boolean) => !open && close()"
  >
    <div class="brand_modal wallet_connect">
      <div class="brand_modal__head">
        <div class="brand_modal__heading wallet_connect__head">
          <button
            v-if="step === 'connecting' || step === 'failed' || helpView"
            type="button"
            class="wallet_connect__back"
            aria-label="Back to wallets"
            @click="backToList"
          >
            <Icon icon="material-symbols:arrow-back" width="1.125rem" />
          </button>
          <div>
            <div class="brand_modal__eyebrow">
              {{ eyebrow }}
            </div>
            <h2 class="brand_modal__title">
              {{ title }}
            </h2>
          </div>
        </div>

        <button
          type="button"
          class="brand_modal__close"
          aria-label="Close"
          @click="close"
        >
          <Icon icon="material-symbols:close" width="1.125rem" />
        </button>
      </div>

      <div class="brand_modal__body">
        <!-- Pick a wallet -->
        <template v-if="step === 'select' && !helpView">
          <template v-if="wallets.length">
            <section
              v-for="section in sections"
              :key="section.key"
              class="wallet_connect__section"
            >
              <div v-if="section.title" class="wallet_connect__eyebrow">
                {{ section.title }}
              </div>
              <ul class="wallet_connect__list">
                <li v-for="wallet in section.wallets" :key="wallet.label">
                  <button
                    type="button"
                    class="wallet_connect__item"
                    :class="{ 'wallet_connect__item--recommended': isRecommended(wallet) }"
                    @click="connect(wallet)"
                  >
                    <WalletMark :icon="wallet.icon" :glyph="wallet.glyph" />
                    <span class="wallet_connect__item_text">
                      <span class="wallet_connect__item_name">{{ wallet.label }}</span>
                      <span
                        class="wallet_connect__item_meta"
                        :class="{ 'wallet_connect__item_meta--reason': isRecommended(wallet) }"
                      >
                        {{ metaOf(wallet) }}
                      </span>
                    </span>
                    <span
                      v-if="wallet.label === lastUsedLabel && !isRecommended(wallet)"
                      class="wallet_connect__badge"
                    >
                      Last used
                    </span>
                    <Icon
                      class="wallet_connect__chevron"
                      icon="material-symbols:chevron-right-rounded"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              </ul>
            </section>
            <button
              v-if="hiddenWallets.length"
              type="button"
              class="wallet_connect__more"
              @click="showAllWallets = true"
            >
              Show {{ hiddenWallets.length }} more
              <Icon icon="material-symbols:keyboard-arrow-down-rounded" aria-hidden="true" />
            </button>
          </template>
          <div v-else class="wallet_connect__empty">
            Loading wallets
          </div>

          <p v-if="notice" class="wallet_connect__notice">
            {{ notice }}
          </p>

          <div class="wallet_connect__links">
            <button
              type="button"
              class="wallet_connect__link"
              @click="helpView = 'get'"
            >
              I don't have a wallet
            </button>
            <button
              type="button"
              class="wallet_connect__link"
              @click="helpView = 'missing'"
            >
              Why don't I see my wallet?
            </button>
          </div>
        </template>

        <!-- No wallet yet -->
        <div v-else-if="step === 'select' && helpView === 'get'" class="wallet_connect__help">
          <p>
            A wallet holds your account and signs for it. Install one of
            these, then come back to connect.
          </p>
          <ul class="wallet_connect__list">
            <li v-for="wallet in recommendedWallets" :key="wallet.name">
              <a
                class="wallet_connect__item"
                :href="wallet.url"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span class="wallet_connect__item_text">
                  <span class="wallet_connect__item_name">{{ wallet.name }}</span>
                  <span class="wallet_connect__item_meta">{{ hostOf(wallet.url) }}</span>
                </span>
                <Icon
                  class="wallet_connect__chevron"
                  icon="material-symbols:arrow-outward-rounded"
                  aria-hidden="true"
                />
              </a>
            </li>
          </ul>
          <a
            class="wallet_connect__link"
            :href="FIND_WALLET_URL"
            target="_blank"
            rel="noopener noreferrer"
          >
            Compare more wallets on ethereum.org
            <Icon icon="material-symbols:arrow-outward-rounded" />
          </a>
        </div>

        <!-- An installed wallet that is not in the list -->
        <div v-else-if="step === 'select' && helpView === 'missing'" class="wallet_connect__help">
          <ol class="wallet_connect__checks">
            <li v-for="check in MISSING_WALLET_CHECKS" :key="check">
              {{ check }}
            </li>
          </ol>
          <template v-if="walletConnectOption">
            <p>Any wallet that supports WalletConnect can also connect by QR code.</p>
            <v-btn color="primary" size="small" @click="connect(walletConnectOption)">
              Connect with WalletConnect
            </v-btn>
          </template>
        </div>

        <!-- Waiting on the wallet, and what came of it -->
        <div v-else-if="selected" class="wallet_connect__status">
          <div
            class="wallet_connect__status_mark"
            :class="`wallet_connect__status_mark--${step}`"
          >
            <WalletMark :icon="selected.icon" :glyph="selected.glyph" large />
            <span
              v-if="step === 'connected'"
              class="wallet_connect__status_badge wallet_connect__status_badge--ok"
            >
              <Icon icon="material-symbols:check-rounded" />
            </span>
            <span
              v-else-if="step === 'failed'"
              class="wallet_connect__status_badge wallet_connect__status_badge--fail"
            >
              <Icon icon="material-symbols:close-rounded" />
            </span>
          </div>

          <template v-if="step === 'connecting'">
            <p class="wallet_connect__status_text">
              Approve the request in {{ selected.label }}.
              Select every account you want to use here.
            </p>
          </template>

          <template v-else-if="step === 'connected'">
            <p class="wallet_connect__status_text">
              <span class="wallet_connect__address">{{ connectedAddress }}</span>
            </p>
          </template>

          <template v-else-if="step === 'failed'">
            <p class="wallet_connect__status_text">
              {{ failure?.text }}
            </p>
            <div class="wallet_connect__actions">
              <a
                v-if="failure?.href"
                class="wallet_connect__link"
                :href="failure.href"
                target="_blank"
                rel="noopener noreferrer"
              >
                Get {{ selected.label }}
                <Icon icon="material-symbols:arrow-outward-rounded" />
              </a>
              <v-btn
                v-else
                color="primary"
                size="small"
                @click="connect(selected)"
              >
                Try again
              </v-btn>
            </div>
          </template>
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import safeIcon from "@web3-onboard/gnosis/dist/icon.js";
import fordefiIcon from "@web3-onboard/injected-wallets/dist/icons/fordefi.js";
import {
  connectByLabel,
  pendingConnectLabel,
  readLastConnectedWallet,
  svgMarkup,
  takeInterfaceError,
} from "~/composables/walletModules";
import {
  recommendWallet,
  type WalletRecommendation,
} from "~/composables/walletRecommendation";
import { useAccountStore } from "~/store/account/account.store";

/**
 * The app's wallet picker. Web3-Onboard still does the connecting (wallet
 * detection, providers, the remembered wallet that reconnects on load); this
 * replaces only its modal. Each pick calls `connectWallet` with that wallet's
 * label and Web3-Onboard's own modals disabled.
 */

interface WalletOption {
  label: string;
  icon: string;
  kind: string;
  // The Web3-Onboard module this row connects through, when not its own.
  via?: string;
  // Set on a row for a wallet that is not installed: picking it says so.
  installUrl?: string;
  // An Iconify glyph, for a wallet with no mark of its own here.
  glyph?: string;
  // Read silently on open, for the recommendation: an extension found in
  // this browser, and an account it has already approved for this site.
  installed?: boolean;
  authorizedAccount?: string;
  // A browser extension's module (set in plugins/web3-onboard.ts); the rest
  // connect without anything installed here.
  isExtension?: boolean;
}

type Step = "select" | "connecting" | "connected" | "failed";

const FIND_WALLET_URL = "https://ethereum.org/en/wallets/find-wallet/";

// "Why don't I see my wallet?": the usual reasons an installed extension is
// not detected, most common first. (The link this replaced, a Blocknative
// article, is gone.)
const MISSING_WALLET_CHECKS = [
  "Unlock the wallet extension, then reload this page.",
  "Check the extension is turned on, and allowed in private windows if you are in one.",
  "Two wallet extensions can hide each other. Turn one off and reload.",
  "On a phone, open this page in your wallet app's own browser.",
];

// The line under the name of a wallet that is not a browser extension.
const WALLET_KINDS: Record<string, string> = {
  "WalletConnect": "Mobile or desktop app, by QR code",
  "Coinbase Wallet": "Smart wallet or Coinbase app",
  "Ledger": "Hardware wallet",
  "Trezor": "Hardware wallet",
  "Safe": "Open inside this Safe",
};

// Wallets with no module of their own here, listed by name so they can be
// found. A detected module of the same label replaces the row: Fordefi's
// once its extension is installed, Safe's when the app is open inside a
// Safe. Fireblocks and a Safe opened anywhere else connect to dApps through
// WalletConnect.
const NAMED_WALLETS: WalletOption[] = [
  {
    label: "Safe",
    icon: safeIcon,
    kind: "Through WalletConnect",
    via: "WalletConnect",
  },
  {
    label: "Fordefi",
    icon: fordefiIcon,
    kind: "Not installed",
    installUrl: "https://www.fordefi.com/solutions/browser-extension",
  },
  {
    label: "Fireblocks",
    icon: "",
    glyph: "material-symbols:account-balance-outline-rounded",
    kind: "Through WalletConnect",
    via: "WalletConnect",
  },
];

// The list's order: most used first, by broad EVM wallet usage (our call,
// not measured on Rethink). A wallet missing here, say a new extension,
// follows the named ones.
const POPULARITY = [
  "MetaMask",
  "WalletConnect",
  "Coinbase Wallet",
  "Rabby Wallet",
  "Trust Wallet",
  "OKX Wallet",
  "Phantom",
  "Ledger",
  "Safe",
  "Trezor",
  "Rainbow",
  "Zerion",
  "Brave Wallet",
  "Fireblocks",
  "Fordefi",
  "Zodiac Pilot",
  "Frame",
  "Enkrypt",
].map((label) => label.toLowerCase());

const popularityRank = ({ label }: WalletOption) => {
  const rank = POPULARITY.indexOf(label.toLowerCase());
  return rank === -1 ? POPULARITY.length : rank;
};

const moduleOf = (wallet?: WalletOption) => wallet?.via ?? wallet?.label ?? "";

// These draw their own modal (a QR code, a hardware wallet's account picker,
// Coinbase's sign-in), which ours would sit on top of, so ours steps aside
// until the attempt settles. The Coinbase extension draws nothing here.
const OWN_UI_WALLETS = new Set(["WalletConnect", "Coinbase Wallet", "Ledger", "Trezor"]);
const ownsUi = (wallet?: WalletOption) =>
  OWN_UI_WALLETS.has(moduleOf(wallet)) && !wallet?.isExtension;
// A wallet that does not answer in this long is treated as unapproved.
const PROBE_TIMEOUT_MS = 800;

const accountStore = useAccountStore();
const { $onboard, $onboardWallets } = useNuxtApp() as any;

const wallets = ref<WalletOption[]>([]);
const step = ref<Step>("select");
const selected = ref<WalletOption>();
const failure = ref<{ text: string; href?: string }>();
const notice = ref("");
// A help view over the list: "get" (no wallet yet) or "missing" (an
// installed wallet that is not listed).
const helpView = ref<"" | "get" | "missing">("");
const lastUsedLabel = ref<string>();
const recommendation = ref<WalletRecommendation>();

const showAllWallets = ref(false);

// Not installed, but shown without "Show more": the common ways in for
// someone with no extension. Detected wallets always sit above these.
const FEATURED_WALLETS = new Set(["Rabby Wallet", "WalletConnect", "Ledger"]);

const isRecommended = (wallet: WalletOption) =>
  wallet.label === recommendation.value?.label;

// Found in this browser (or the Safe the app is open in), the pick first.
const detectedWallets = computed(() =>
  wallets.value
    .filter((wallet) => wallet.installed || (wallet.label === "Safe" && !wallet.via))
    .sort((a, b) => Number(isRecommended(b)) - Number(isRecommended(a))),
);

const otherWallets = computed(() =>
  wallets.value
    .filter((wallet) => !detectedWallets.value.includes(wallet))
    .sort((a, b) => Number(isRecommended(b)) - Number(isRecommended(a))),
);

// The pick and the last-used wallet never hide behind "Show more".
const isFeatured = (wallet: WalletOption) =>
  FEATURED_WALLETS.has(wallet.label) ||
  isRecommended(wallet) ||
  wallet.label === lastUsedLabel.value;

const hiddenWallets = computed(() =>
  showAllWallets.value ? [] : otherWallets.value.filter((wallet) => !isFeatured(wallet)),
);

const sections = computed(() => [
  { key: "detected", title: "Detected", wallets: detectedWallets.value },
  {
    key: "other",
    title: detectedWallets.value.length ? "Other wallets" : "",
    wallets: otherWallets.value.filter((wallet) => !hiddenWallets.value.includes(wallet)),
  },
].filter((section) => section.wallets.length));

const metaOf = (wallet: WalletOption) => {
  if (isRecommended(wallet)) return recommendation.value?.reason;
  if (wallet.authorizedAccount) {
    const address = wallet.authorizedAccount;
    return `Approved for this site as ${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  return wallet.kind;
};

const isOpen = computed(() => accountStore.isConnectModalOpen);
const isVisible = computed(() =>
  isOpen.value &&
  !(step.value === "connecting" && ownsUi(selected.value)),
);

const walletConnectOption = computed(() =>
  wallets.value.find(({ label }) => label === "WalletConnect"),
);

const recommendedWallets = computed<{ name: string; url: string }[]>(
  () => $onboard?.state.get().appMetadata?.recommendedInjectedWallets ?? [],
);

const eyebrow = computed(() => {
  if (helpView.value) return "Wallet";
  switch (step.value) {
    case "connecting": return "Waiting for approval";
    case "connected": return "Connected";
    case "failed": return "Not connected";
    default: return "Wallet";
  }
});

const title = computed(() => {
  if (helpView.value === "get") return "Get a wallet";
  if (helpView.value === "missing") return "Wallet not listed";
  switch (step.value) {
    case "connecting": return `Connecting to ${selected.value?.label}`;
    case "connected": return `${selected.value?.label} connected`;
    case "failed": return "Connection not completed";
    default: return "Connect a wallet";
  }
});

const connectedAddress = computed(() => {
  const address = accountStore.activeAccountAddress ?? "";
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
});

const hostOf = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const loadWallets = async () => {
  if (!$onboard) return;
  // Re-read the modules on every open (unless a connect is holding them):
  // wallets that announce themselves late (EIP-6963) only show up this way.
  if (!pendingConnectLabel.value) $onboard.state.actions.setWalletModules($onboardWallets);
  const modules = $onboard.state.get().walletModules as any[];
  const detected: WalletOption[] = await Promise.all(
    modules.map(async (module) => {
      const probe = await probeExtension(module);
      return {
        label: module.label,
        icon: String(await module.getIcon()),
        kind: probe.installed === false
          ? "Not installed"
          : module.isExtension
            ? "Browser extension"
            : WALLET_KINDS[module.label] ?? "Connects without an extension",
        isExtension: !!module.isExtension,
        ...probe,
      };
    }),
  );
  wallets.value = [
    ...detected,
    ...NAMED_WALLETS.filter(
      ({ label }) => !detected.some((wallet) => wallet.label === label),
    ),
  ].sort((a, b) => popularityRank(a) - popularityRank(b));
  recommendation.value = recommendWallet(
    wallets.value.map((wallet) => ({
      label: wallet.label,
      installed: !!wallet.installed,
      authorizedAccount: wallet.authorizedAccount,
      alwaysAvailable: !wallet.isExtension && !wallet.installUrl,
      via: wallet.via,
    })),
    lastUsedLabel.value,
  );
};

/**
 * Whether an extension module is really installed, and which account it has
 * already approved for this site. `eth_accounts` never prompts: a wallet that
 * has not approved the site, or is locked, answers with an empty list.
 * Skipped while a connect is open, so the probe never races it.
 */
async function probeExtension(module: any): Promise<Partial<WalletOption>> {
  if (!module.isExtension || pendingConnectLabel.value) return {};
  const timeout = new Promise<undefined>((resolve) => setTimeout(resolve, PROBE_TIMEOUT_MS));
  try {
    const { provider } = await module.getInterface({
      chains: $onboard.state.get().chains,
      appMetadata: $onboard.state.get().appMetadata,
    });
    // A wallet that failed to load (Enkrypt not installed) is not one.
    if (takeInterfaceError(module.label)) return { installed: false };
    const accounts = await Promise.race([
      provider.request({ method: "eth_accounts" }).catch(() => []),
      timeout,
    ]);
    return {
      installed: true,
      authorizedAccount: Array.isArray(accounts) ? accounts[0] : undefined,
    };
  } catch {
    return { installed: false };
  }
}

const resetView = () => {
  step.value = "select";
  helpView.value = "";
  showAllWallets.value = false;
  notice.value = "";
  failure.value = undefined;
};

watch(isOpen, async (open) => {
  if (!open) return;
  resetView();
  lastUsedLabel.value = readLastConnectedWallet();
  await loadWallets();
  // A connect already open (the reconnect on load, waiting on a locked
  // wallet) is shown rather than left to block the picks behind it.
  const pending = wallets.value.find((wallet) => moduleOf(wallet) === pendingConnectLabel.value);
  if (pending) connect(pending);
});

// Web3-Onboard adds the wallet a beat before its connect call returns, so the
// confirmation shows as soon as the account is in.
watch(
  () => accountStore.connectedWallet?.label,
  (label) => {
    if (step.value === "connecting" && label && label === moduleOf(selected.value)) {
      step.value = "connected";
    }
  },
);

const toFailure = (message?: string) => {
  if (!message) {
    return {
      text: `${selected.value?.label} did not approve the request. It may have been declined, or it is still open in the wallet.`,
    };
  }
  // Web3-Onboard's install hints are HTML ("Please <a href=…>install</a> …"),
  // so a link means the wallet is missing, and that is said in our words.
  const href = message.match(/href="([^"]+)"/)?.[1];
  if (href) {
    return {
      text: `${selected.value?.label} is not installed or is turned off in this browser.`,
      href,
    };
  }
  return { text: message.replace(/<[^>]+>/g, "").trim() };
};

const connect = async (wallet: WalletOption) => {
  notice.value = "";
  const pendingLabel = pendingConnectLabel.value;
  if (pendingLabel && pendingLabel !== moduleOf(wallet)) {
    notice.value = `${pendingLabel} still has a connection request open. Approve or reject it there first.`;
    return;
  }

  helpView.value = "";
  selected.value = wallet;
  if (wallet.installUrl) {
    failure.value = toFailure(`<a href="${wallet.installUrl}">`);
    step.value = "failed";
    return;
  }
  failure.value = undefined;
  step.value = "connecting";

  await connectByLabel(
    (options) => accountStore.web3Onboard?.connectWallet(options),
    moduleOf(wallet),
  );

  if (!isOpen.value) return;
  // Approved, even if the user went back to the list while it was pending.
  if (accountStore.connectedWallet?.label === moduleOf(wallet)) {
    accountStore.closeConnectModal();
    return;
  }
  // The user went back to the list meanwhile; nothing to report.
  if (selected.value?.label !== wallet.label || (step.value as Step) === "select") return;

  const loadError = takeInterfaceError(moduleOf(wallet));
  // Closing a wallet's own QR or Ledger modal is the user backing out.
  if (!loadError && ownsUi(wallet)) {
    step.value = "select";
    return;
  }
  failure.value = toFailure(loadError);
  step.value = "failed";
};

const backToList = () => {
  if (helpView.value) {
    helpView.value = "";
    return;
  }
  resetView();
};

const close = () => {
  accountStore.closeConnectModal();
};

/**
 * Some wallets ship a white-only icon, drawn for Web3-Onboard's dark modal,
 * which vanishes on a light tile. Which wallets do is up to whatever the
 * user has installed, so the icon itself is measured: drawn small to a
 * canvas, it counts as light when its visible pixels are bright and it does
 * not fill its own square (an icon with its own backdrop reads anywhere).
 * Unreadable icons (a cross-origin URL taints the canvas) count as not light.
 */
const lightIconCache = new Map<string, Promise<boolean>>();

function isLightIcon(icon: string): Promise<boolean> {
  if (!lightIconCache.has(icon)) lightIconCache.set(icon, measureIcon(icon));
  return lightIconCache.get(icon)!;
}

function measureIcon(icon: string): Promise<boolean> {
  // An icon drawn in the theme text colour follows the tile (see .wallet_mark)
  // and never needs the dark tile; it measures as dark here because the
  // variable falls back to currentColor (black) outside the page.
  const markup = svgMarkup(icon);
  const src = markup
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
    : icon.trim();
  return new Promise((resolve) => {
    const image = new Image();
    image.onerror = () => resolve(false);
    image.onload = () => {
      try {
        const size = 32;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context) return resolve(false);
        context.drawImage(image, 0, 0, size, size);
        const { data } = context.getImageData(0, 0, size, size);
        // Weighted by opacity, so a faint, half-transparent white glyph
        // still counts; coverage counts only the solid pixels.
        let weight = 0;
        let luminance = 0;
        let solid = 0;
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3] / 255;
          if (alpha < 0.1) continue;
          weight += alpha;
          luminance += alpha * (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
          if (alpha > 0.5) solid++;
        }
        const coverage = solid / (size * size);
        resolve(weight > 0 && coverage < 0.85 && luminance / weight > 0.75);
      } catch {
        resolve(false);
      }
    };
    image.src = src;
  });
}

/** A wallet's mark: Web3-Onboard hands over inline SVG or an image URL. */
const WalletMark = defineComponent({
  props: { icon: { type: String, required: true }, glyph: { type: String, default: "" }, large: Boolean },
  setup(props) {
    const IconifyIcon = resolveComponent("Icon");
    const isLight = ref(false);
    watch(
      () => props.icon,
      async (icon) => {
        isLight.value = !!icon && await isLightIcon(icon);
      },
      { immediate: true },
    );
    return () => {
      const markup = svgMarkup(props.icon);
      const className = [
        "wallet_mark",
        props.large && "wallet_mark--large",
        isLight.value && "wallet_mark--light-icon",
      ];
      if (props.glyph) {
        return h("span", { class: [...className, "wallet_mark--glyph"], "aria-hidden": "true" }, [
          h(IconifyIcon, { icon: props.glyph }),
        ]);
      }
      return markup
        ? h("span", { class: className, innerHTML: markup, "aria-hidden": "true" })
        : h("span", { class: className, "aria-hidden": "true" }, [h("img", { src: props.icon.trim(), alt: "" })]);
    };
  },
});
</script>

<style scoped lang="scss">
.wallet_connect {
  &__head {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  /* Sized like the close target, so the two ends of the head row match. */
  &__back {
    display: grid;
    place-items: center;
    flex: none;
    width: 2rem;
    height: 2rem;
    margin-left: -0.5rem;
    border-radius: $default-border-radius;
    color: $color-steel-blue;
    cursor: pointer;
    transition: background-color $default-transition-time ease,
      color $default-transition-time ease;

    &:hover,
    &:focus-visible {
      outline: none;
      background: $color-gray-light-transparent;
      color: $color-white;
    }
  }

  /* One framed list with divider rows, like the library pickers. */
  &__eyebrow {
    margin: 0 0 0.5rem;
    font-family: $font-mono;
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__section + &__section {
    margin-top: 1.25rem;
  }

  &__list {
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid $color-line;
    border-radius: $default-border-radius;
    background: $color-card-background;
    overflow: hidden;

    li + li {
      border-top: 1px solid $color-line;
    }
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.75rem 0.875rem;
    text-align: left;
    text-decoration: none;
    color: $color-white;
    cursor: pointer;
    transition: background-color $default-transition-time ease;

    &:hover,
    &:focus-visible {
      outline: none;
      background: $color-gray-light-transparent;

      .wallet_connect__chevron {
        color: $color-white;
        transform: translateX(2px);
      }
    }
  }

  &__item_text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    flex: 1;
    min-width: 0;
  }

  &__item_name {
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
  }

  &__item_meta {
    font-family: $font-mono;
    font-size: 11px;
    line-height: 1.4;
    color: $color-steel-blue;

    &--reason {
      color: $color-cyan;
    }
  }

  /* The pick, first of the detected wallets: tinted like a selected
     state, its reason in cyan under the name. */
  &__item--recommended {
    background: $color-cyan-tint;

    &:hover,
    &:focus-visible {
      background: $color-cyan-tint;
      box-shadow: inset 0 0 0 1px $color-cyan-line;
    }
  }

  &__more {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    width: 100%;
    margin-top: 0.5rem;
    padding: 0.5rem;
    border-radius: $default-border-radius;
    font-size: 13px;
    font-weight: 500;
    color: $color-steel-blue;
    cursor: pointer;
    transition: background-color $default-transition-time ease,
      color $default-transition-time ease;

    &:hover,
    &:focus-visible {
      outline: none;
      background: $color-gray-light-transparent;
      color: $color-white;
    }
  }

  &__badge {
    flex: none;
    padding: 0.125rem 0.5rem;
    border: 1px solid $color-cyan-line;
    border-radius: 999px;
    background: $color-cyan-tint;
    font-family: $font-mono;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-cyan;
  }

  &__chevron {
    flex: none;
    font-size: 18px;
    color: $color-steel-blue;
    transition: color $default-transition-time ease,
      transform $default-transition-time ease;
  }

  &__empty {
    padding: 1.5rem 0;
    text-align: center;
    font-family: $font-mono;
    font-size: 12px;
    color: $color-steel-blue;
  }

  &__notice {
    margin: 0.75rem 0 0 !important;
    padding: 0.625rem 0.75rem;
    border: 1px solid $color-warn-line;
    border-radius: $default-border-radius;
    background: $color-warn-soft;
    font-size: 13px;
    line-height: 1.5;
    color: $color-white;
  }

  &__links {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    margin-top: 1rem;
  }

  &__link {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 13px;
    font-weight: 500;
    text-decoration: none;
    color: $color-cyan;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }

  &__help {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;

    p {
      margin: 0 !important;
    }

    .wallet_connect__list {
      align-self: stretch;
    }
  }

  /* Numbered checks, the number in the mono accent like a step index. */
  &__checks {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
    counter-reset: check;

    li {
      display: flex;
      gap: 0.75rem;
      counter-increment: check;

      &::before {
        content: counter(check);
        flex: none;
        width: 1rem;
        font-family: $font-mono;
        font-size: 12px;
        line-height: 1.6rem;
        color: $color-cyan;
      }
    }
  }

  &__status {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 0 0.25rem;
    text-align: center;
  }

  /* The wallet's mark inside a ring: turning while the wallet is asked,
     settled green or red once it has answered. */
  &__status_mark {
    position: relative;
    display: grid;
    place-items: center;
    width: 84px;
    height: 84px;
    border-radius: 999px;
    border: 2px solid $color-line-2;

    &--connecting::before {
      content: "";
      position: absolute;
      inset: -2px;
      border-radius: inherit;
      border: 2px solid transparent;
      border-top-color: $color-cyan-raw;
      animation: wallet-connect-spin 0.9s linear infinite;
    }

    &--connected {
      border-color: $color-yield-line;
    }

    &--failed {
      border-color: $color-neg-line;
    }
  }

  &__status_badge {
    position: absolute;
    right: -2px;
    bottom: -2px;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    border: 2px solid $color-navy-gray-light;
    font-size: 14px;
    color: #fff;

    &--ok {
      background: $color-pos;
    }

    &--fail {
      background: $color-neg;
    }
  }

  &__status_text {
    max-width: 320px;
    margin: 0 !important;
  }

  &__address {
    font-family: $font-mono;
    color: $color-white;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
}

.wallet_mark {
  display: grid;
  place-items: center;
  flex: none;
  width: 36px;
  height: 36px;
  padding: 6px;
  border: 1px solid $color-line-2;
  border-radius: 8px;
  background: $color-gray-light-transparent;
  overflow: hidden;
  /* Some icons (Safe, Trezor) paint in Web3-Onboard's theme text colour,
     which its dark theme sets near-white for the whole page; they follow the
     app's ink instead, so they read in both themes. */
  --w3o-text-color: #{$color-white};

  :deep(svg),
  :deep(img) {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* A stand-in glyph, for a wallet with no mark here: drawn in the
     interface's own ink rather than faking a brand colour. */
  &--glyph {
    color: $color-white;

    :deep(svg) {
      width: 100%;
      height: 100%;
    }
  }

  &--large {
    width: 56px;
    height: 56px;
    padding: 10px;
    border-radius: 12px;
  }
}

/* A white-only wallet icon (see isLightIcon) keeps a dark tile when the page
   turns light; in dark mode the default tile already carries it. */
:global([data-theme="light"] .wallet_mark.wallet_mark--light-icon) {
  border-color: transparent;
  background: var(--wallet-mark-ink);
}

@keyframes wallet-connect-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .wallet_connect__status_mark--connecting::before {
    animation-duration: 2.4s;
  }
}
</style>
