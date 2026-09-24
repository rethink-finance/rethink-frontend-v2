<template>
  <div class="ndfi">
    <div class="brand_card ndfi_card">
      <!-- Sell -->
      <div class="ndfi_box" :class="{ 'ndfi_box--focus': focused === 'sell' }">
        <div class="ndfi_box__label">
          Sell
        </div>
        <div class="ndfi_box__row">
          <input
            v-model="amountText"
            class="ndfi_amount"
            inputmode="decimal"
            placeholder="0"
            spellcheck="false"
            autocomplete="off"
            @focus="focused = 'sell'"
            @blur="focused = null"
          >
          <div class="ndfi_picker">
            <button class="ndfi_token" type="button" @click="togglePicker('sell')">
              <ExecutionTokenMark :symbol="sellToken.symbol" />
              <span>{{ sellToken.symbol }}</span>
              <span class="ndfi_token__chevron">▾</span>
            </button>
            <div v-if="picker === 'sell'" class="ndfi_menu">
              <button
                v-for="t in INDEFI_TOKENS"
                :key="t.symbol"
                class="ndfi_menu__item"
                :class="{ 'ndfi_menu__item--on': t.symbol === sellToken.symbol }"
                type="button"
                @click="pick('sell', t)"
              >
                <ExecutionTokenMark :symbol="t.symbol" />
                <span class="ndfi_menu__symbol">{{ t.symbol }}</span>
                <span class="ndfi_menu__balance">{{ fmtBalance(t) }}</span>
              </button>
            </div>
          </div>
        </div>
        <div class="ndfi_box__meta">
          <span>{{ sellUsdText }}</span>
          <span class="ndfi_box__balance">
            Balance: {{ fmtBalance(sellToken) }}
            <button
              v-if="(holdingOf(sellToken)?.balance ?? 0n) > 0n"
              class="ndfi_max"
              type="button"
              @click="setMax"
            >
              Max
            </button>
          </span>
        </div>
      </div>

      <!-- Flip -->
      <div class="ndfi_flip_row">
        <button
          class="ndfi_flip"
          type="button"
          title="Swap direction"
          @click="flip"
        >
          <Icon icon="material-symbols:arrow-downward-rounded" width="1.1rem" height="1.1rem" />
        </button>
      </div>

      <!-- Buy -->
      <div class="ndfi_box ndfi_box--buy">
        <div class="ndfi_box__label">
          Buy
        </div>
        <div class="ndfi_box__row">
          <div
            class="ndfi_amount ndfi_amount--out"
            :class="{ 'ndfi_amount--muted': !quote, 'ndfi_amount--loading': quoting && !quote }"
          >
            {{ quote ? fmtUnits(quote.amountOut, buyToken.decimals, 6) : "0" }}
          </div>
          <div class="ndfi_picker">
            <button class="ndfi_token" type="button" @click="togglePicker('buy')">
              <ExecutionTokenMark :symbol="buyToken.symbol" />
              <span>{{ buyToken.symbol }}</span>
              <span class="ndfi_token__chevron">▾</span>
            </button>
            <div v-if="picker === 'buy'" class="ndfi_menu">
              <button
                v-for="t in INDEFI_TOKENS"
                :key="t.symbol"
                class="ndfi_menu__item"
                :class="{ 'ndfi_menu__item--on': t.symbol === buyToken.symbol }"
                type="button"
                @click="pick('buy', t)"
              >
                <ExecutionTokenMark :symbol="t.symbol" />
                <span class="ndfi_menu__symbol">{{ t.symbol }}</span>
                <span class="ndfi_menu__balance">{{ fmtBalance(t) }}</span>
              </button>
            </div>
          </div>
        </div>
        <div class="ndfi_box__meta">
          <span>
            {{ buyUsdText }}
            <em
              v-if="quote && quote.impactPct"
              class="ndfi_impact"
              :class="{ 'ndfi_impact--bad': quote.impactPct < -Number(slippage) }"
            >({{ quote.impactPct > 0 ? "+" : "" }}{{ quote.impactPct.toFixed(2) }}%)</em>
          </span>
          <span class="ndfi_box__balance">Balance: {{ fmtBalance(buyToken) }}</span>
        </div>
      </div>

      <!-- Price and route -->
      <details
        v-if="quote"
        class="ndfi_summary"
        :open="summaryOpen"
        @toggle="summaryOpen = ($event.target as HTMLDetailsElement).open"
      >
        <summary>
          <span class="ndfi_summary__rate">{{ rateText }}</span>
          <span class="ndfi_summary__age">{{ quoting ? "updating…" : quoteAgeText }}</span>
          <span class="ndfi_summary__chevron">▾</span>
        </summary>
        <div class="ndfi_summary__body">
          <div class="ndfi_kv">
            <span>Route</span><span>{{ quote.route.label }}</span>
          </div>
          <div class="ndfi_kv">
            <span>Min. received</span><span>{{ fmtUnits(quote.minReturn, buyToken.decimals, 6) }} {{ buyToken.symbol }}</span>
          </div>
          <div class="ndfi_kv ndfi_kv--control">
            <span>Max slippage</span>
            <span>
              <input
                v-model="slippage"
                class="ndfi_slippage"
                inputmode="decimal"
                spellcheck="false"
              >%
            </span>
          </div>
          <div class="ndfi_kv">
            <span>Receiver</span><span>Safe {{ shortAddress(INDEFI.ADDR.safe) }}</span>
          </div>
          <div class="ndfi_kv">
            <span>Executor</span><span>Rethink {{ shortAddress(SWAP_EXECUTOR.address) }}</span>
          </div>
          <div class="ndfi_kv">
            <span>Sent as</span>
            <span>{{ isConnectedAsSafe ? "the Safe, unwrapped" : `Roles ${shortAddress(INDEFI.ADDR.roles)} · role ${INDEFI.ROLE}` }}</span>
          </div>
          <div v-if="quote.alternatives.length" class="ndfi_kv ndfi_kv--stack">
            <span>Other quotes</span>
            <span>
              <div v-for="alt in quote.alternatives" :key="alt">{{ alt }}</div>
            </span>
          </div>
          <button
            class="ndfi_link"
            type="button"
            @click="copyText(quote.inner.data, 'Calldata copied.')"
          >
            Copy swap() calldata
          </button>
        </div>
      </details>

      <!-- Notices -->
      <div v-if="notice" class="ndfi_notice" :class="{ 'ndfi_notice--bad': noticeBad }">
        {{ notice }}
      </div>

      <!-- Action -->
      <v-tooltip activator="parent" location="bottom" :disabled="!cta.hint">
        <template #activator>
          <v-btn
            class="ndfi_cta"
            :class="cta.disabled ? '' : 'bg-primary text-secondary'"
            variant="flat"
            size="large"
            block
            :loading="cta.loading"
            :disabled="cta.disabled"
            @click="cta.action?.()"
          >
            {{ cta.text }}
          </v-btn>
        </template>
        <template #default>
          {{ cta.hint }}
        </template>
      </v-tooltip>

      <!-- Result -->
      <div v-if="lastSwap" class="ndfi_done">
        <Icon icon="octicon:check-circle-fill-16" width="1rem" height="1rem" />
        <span>
          Swapped {{ lastSwap.sold }} for {{ lastSwap.bought }}
        </span>
        <a :href="INDEFI.EXPLORER + '/tx/' + lastSwap.hash" target="_blank" rel="noopener noreferrer">view</a>
      </div>
      <div v-else-if="txHash && phase === 'pending'" class="ndfi_pending">
        <a :href="INDEFI.EXPLORER + '/tx/' + txHash" target="_blank" rel="noopener noreferrer">
          {{ shortAddress(txHash) }} · waiting for the block
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import {
  INDEFI,
  INDEFI_SWAP_RULES,
  INDEFI_TOKENS,
  fmtUnits,
  fmtUsd,
  indefiInner,
  indefiReadState,
  indefiSafeBalance,
  parseAmount,
  type IndefiInner,
  type IndefiState,
  type IndefiToken,
} from "~/composables/execution/indefiConsole";
import {
  BASE_VENUES,
  SWAP_EXECUTOR,
  buildExecutorSwap,
  discoverRoutes,
  minReturnFor,
  quoteRoutes,
  readExecutorState,
  swapDeadline,
  type ExecutorState,
  type OnchainRoute,
} from "~/composables/execution/onchainSwap";
import {
  parseOneInchSwap,
  shortAddress,
  swapImpactPct,
  validateOneInchSwap,
} from "~/composables/execution/oneInchSwap";
import {
  sendCuratorTransaction,
  simulateCuratorTransaction,
  useCuratorExecution,
  type ICuratorRoute,
} from "~/composables/permissions/useCuratorExecution";
import { RolesVersion } from "~/composables/permissions/useRoleExecution";
import { useAccountStore } from "~/store/account/account.store";
import { useToastStore } from "~/store/toasts/toast.store";

const toastStore = useToastStore();
const accountStore = useAccountStore();

// Every action here acts with the Safe's authority. A curator signs from
// their own wallet and the vault's Roles modifier forwards the call; a
// session connected as the Safe itself gets the inner call unwrapped. The
// route is handed to the shared layer rather than resolved from membership,
// because the modifier and role here are established facts: v1, role 1.
const { canExecute, disabledReason, isConnectedAsSafe } = useCuratorExecution();
const INDEFI_ROUTE: ICuratorRoute = {
  chainId: INDEFI.CHAIN,
  rolesModAddress: INDEFI.ADDR.roles,
  role: INDEFI.ROLE,
  version: RolesVersion.V1,
};

/** Past this an allowance reads as "set and forget" rather than a real number. */
const LARGE_ALLOWANCE = ethers.parseUnits("1000000000", 18);
/** A quote older than this is refreshed before it is signed, and on its own while idle. */
const QUOTE_TTL_MS = 30_000;
const QUOTE_DEBOUNCE_MS = 450;

/* -------------------------------------------------------------------------- */
/* Holdings and the executor                                                   */
/* -------------------------------------------------------------------------- */

const state = ref<IndefiState | null>(null);
const executorState = ref<ExecutorState | "checking">("checking");

const holdingOf = (token: IndefiToken) =>
  state.value?.holdings.find((h) => h.token.symbol === token.symbol);
const priceOf = (token: IndefiToken) => holdingOf(token)?.price ?? 0;
const fmtBalance = (token: IndefiToken) => {
  const held = holdingOf(token)?.balance;
  if (held === undefined) return "—";
  return fmtUnits(held, token.decimals, token.decimals === 6 ? 2 : 4);
};

const refreshState = async () => {
  try {
    state.value = await indefiReadState();
  } catch (error: any) {
    console.error(error);
    toastStore.errorToast(error?.message || "Could not read the Safe's holdings.");
  }
};

/* -------------------------------------------------------------------------- */
/* The pair                                                                    */
/* -------------------------------------------------------------------------- */

const sellSymbol = ref("USDC");
const buySymbol = ref("WETH");
const amountText = ref("");
const slippage = ref("1");
const focused = ref<"sell" | null>(null);
const picker = ref<"sell" | "buy" | null>(null);
const summaryOpen = ref(false);

const tokenBySymbol = (symbol: string): IndefiToken =>
  INDEFI_TOKENS.find((t) => t.symbol === symbol) ?? INDEFI_TOKENS[0];
const sellToken = computed(() => tokenBySymbol(sellSymbol.value));
const buyToken = computed(() => tokenBySymbol(buySymbol.value));

const togglePicker = (side: "sell" | "buy") => {
  picker.value = picker.value === side ? null : side;
};

/** Choosing the other side's token swaps the pair, the way Uniswap does. */
const pick = (side: "sell" | "buy", token: IndefiToken) => {
  picker.value = null;
  if (side === "sell") {
    if (token.symbol === buySymbol.value) buySymbol.value = sellSymbol.value;
    sellSymbol.value = token.symbol;
  } else {
    if (token.symbol === sellSymbol.value) sellSymbol.value = buySymbol.value;
    buySymbol.value = token.symbol;
  }
};

const flip = () => {
  const sell = sellSymbol.value;
  sellSymbol.value = buySymbol.value;
  buySymbol.value = sell;
  // The typed amount stays on the sell side, in the new sell token's units.
  const held = holdingOf(sellToken.value)?.balance ?? 0n;
  const typed = parseAmount(amountText.value, sellToken.value.decimals);
  if (typed && typed > held) amountText.value = "";
};

const closePickers = (event: MouseEvent) => {
  if (!(event.target as HTMLElement)?.closest?.(".ndfi_picker")) picker.value = null;
};
onMounted(() => document.addEventListener("click", closePickers));
onBeforeUnmount(() => document.removeEventListener("click", closePickers));

const amount = computed(() => parseAmount(amountText.value, sellToken.value.decimals));
const slippagePct = computed(() => {
  const value = Number(slippage.value);
  return Number.isFinite(value) && value > 0 && value <= 50 ? value : null;
});
const insufficient = computed(() => {
  const held = holdingOf(sellToken.value)?.balance;
  return !!amount.value && held !== undefined && amount.value > held;
});

const setMax = () => {
  const held = holdingOf(sellToken.value)?.balance ?? 0n;
  amountText.value = held > 0n ? ethers.formatUnits(held, sellToken.value.decimals) : "";
};

const sellUsdText = computed(() => {
  if (!amount.value || !priceOf(sellToken.value)) return "";
  return `≈ $${fmtUsd(Number(ethers.formatUnits(amount.value, sellToken.value.decimals)) * priceOf(sellToken.value))}`;
});
const buyUsdText = computed(() => {
  if (!quote.value || !priceOf(buyToken.value)) return "";
  return `≈ $${fmtUsd(Number(ethers.formatUnits(quote.value.amountOut, buyToken.value.decimals)) * priceOf(buyToken.value))}`;
});

/* -------------------------------------------------------------------------- */
/* Quoting                                                                     */
/* -------------------------------------------------------------------------- */

interface Quote {
  amountIn: bigint;
  amountOut: bigint;
  minReturn: bigint;
  route: OnchainRoute;
  /** The candidates that priced worse, for the record. */
  alternatives: string[];
  /** Against Chainlink marks; negative means value given up. */
  impactPct: number;
  /** The router call, checked against the whitelist. */
  inner: IndefiInner;
  at: number;
}

const quote = ref<Quote | null>(null);
const quoting = ref(false);
const quoteError = ref("");
let quoteSeq = 0;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
/** Pools do not move between sessions; their discovery is done once per pair. */
const routesCache = new Map<string, OnchainRoute[]>();

/**
 * The best route the chain can offer right now: every pool the factories
 * know for the pair (and one hop through another vault asset), each priced
 * by simulating the identical swap from the Safe, the winner built as the
 * router call and held against the whitelist before it is shown.
 */
const fetchQuote = async (
  sell: IndefiToken,
  buy: IndefiToken,
  amountIn: bigint,
  tolerance: number,
): Promise<Quote> => {
  const key = `${sell.symbol}-${buy.symbol}`;
  let routes = routesCache.get(key);
  if (!routes) {
    routes = await discoverRoutes(INDEFI.CHAIN, BASE_VENUES, sell, buy, INDEFI_TOKENS);
    if (routes.length) routesCache.set(key, routes);
  }
  if (!routes.length) {
    throw new Error(`No Uniswap V3 or Aerodrome Slipstream pool trades ${sell.symbol} for ${buy.symbol}.`);
  }
  const quotes = await quoteRoutes(INDEFI.CHAIN, INDEFI.ADDR.safe, routes, amountIn);
  if (!quotes.length) {
    throw new Error(
      `No pool can fill ${fmtUnits(amountIn, sell.decimals, 6)} ${sell.symbol} — try a smaller amount.`,
    );
  }
  const best = quotes[0];
  const minReturn = minReturnFor(best.amountOut, tolerance);
  const { data } = buildExecutorSwap({
    safe: INDEFI.ADDR.safe,
    route: best.route,
    amountIn,
    minReturn,
    deadline: swapDeadline(),
  });
  const call = parseOneInchSwap(data);
  const problems = validateOneInchSwap(call, INDEFI_SWAP_RULES, { sell, buy, amount: amountIn }, 0);
  if (call.executor.toLowerCase() !== SWAP_EXECUTOR.address.toLowerCase()) {
    problems.push("The built swap does not name the Rethink executor.");
  }
  if (problems.length) throw new Error(problems.join(" "));
  return {
    amountIn,
    amountOut: best.amountOut,
    minReturn,
    route: best.route,
    alternatives: quotes
      .slice(1, 4)
      .map((q) => `${q.route.label}: ${fmtUnits(q.amountOut, buy.decimals, 6)} ${buy.symbol}`),
    impactPct: swapImpactPct(amountIn, sell, priceOf(sell), best.amountOut, buy, priceOf(buy)),
    inner: indefiInner.swap(call, data, sell, buy, best.route.label),
    at: Date.now(),
  };
};

/** Re-price what is on screen. Answers to an older question are dropped. */
const refreshQuote = async () => {
  const seq = ++quoteSeq;
  quoteError.value = "";
  if (
    !amount.value ||
    insufficient.value ||
    !slippagePct.value ||
    executorState.value !== "deployed"
  ) {
    quote.value = null;
    quoting.value = false;
    return;
  }
  quoting.value = true;
  try {
    const next = await fetchQuote(sellToken.value, buyToken.value, amount.value, slippagePct.value);
    if (seq !== quoteSeq) return;
    quote.value = next;
  } catch (error: any) {
    if (seq !== quoteSeq) return;
    console.error(error);
    quote.value = null;
    quoteError.value = error?.message || "The route could not be built.";
  } finally {
    if (seq === quoteSeq) quoting.value = false;
  }
};

const scheduleQuote = () => {
  if (debounceTimer) clearTimeout(debounceTimer);
  quote.value = null;
  debounceTimer = setTimeout(refreshQuote, QUOTE_DEBOUNCE_MS);
};

watch([amount, sellSymbol, buySymbol, slippagePct, executorState], scheduleQuote);

// Idle quotes go stale with the pools; refresh them the way a DEX front end does.
const now = ref(Date.now());
const clock = setInterval(() => {
  now.value = Date.now();
  if (quote.value && !quoting.value && phase.value === "idle" && now.value - quote.value.at > QUOTE_TTL_MS) {
    refreshQuote();
  }
}, 5000);
onBeforeUnmount(() => {
  clearInterval(clock);
  if (debounceTimer) clearTimeout(debounceTimer);
});

const quoteAgeText = computed(() => {
  if (!quote.value) return "";
  const seconds = Math.max(0, Math.round((now.value - quote.value.at) / 1000));
  return seconds < 5 ? "just now" : `${seconds}s ago`;
});

const rateText = computed(() => {
  if (!quote.value) return "";
  const inWhole = Number(ethers.formatUnits(quote.value.amountIn, sellToken.value.decimals));
  const outWhole = Number(ethers.formatUnits(quote.value.amountOut, buyToken.value.decimals));
  if (!inWhole) return "";
  const rate = outWhole / inWhole;
  const digits = rate < 0.01 ? 8 : rate < 1 ? 6 : 4;
  return `1 ${sellToken.value.symbol} = ${rate.toLocaleString("en-US", { maximumFractionDigits: digits })} ${buyToken.value.symbol}`;
});

/* -------------------------------------------------------------------------- */
/* Executing                                                                   */
/* -------------------------------------------------------------------------- */

type Phase = "idle" | "approving" | "quoting" | "simulating" | "signing" | "pending";
const phase = ref<Phase>("idle");
const txHash = ref("");
const error = ref("");
const lastSwap = ref<{ sold: string; bought: string; hash: string } | null>(null);

const needsApproval = computed(
  () => (holdingOf(sellToken.value)?.oneInchAllowance ?? 0n) < LARGE_ALLOWANCE,
);

const notice = computed(() => {
  if (error.value) return error.value;
  if (executorState.value === "missing") {
    return `The Rethink swap executor is not deployed on Base yet (${shortAddress(SWAP_EXECUTOR.address)}); swaps cannot be built until it is.`;
  }
  if (executorState.value === "foreign") {
    return `The code at ${shortAddress(SWAP_EXECUTOR.address)} is not the audited swap executor.`;
  }
  if (executorState.value === "unreachable") return "No Base RPC answered.";
  if (quoteError.value) return quoteError.value;
  return "";
});
const noticeBad = computed(() => !!error.value || executorState.value === "foreign");

const busy = computed(() => phase.value !== "idle");

/** The one button, saying what it will do or why it cannot. */
const cta = computed<{ text: string; disabled: boolean; loading?: boolean; hint?: string; action?: () => void }>(() => {
  if (!accountStore.isConnected) return { text: "Connect wallet", disabled: true, hint: disabledReason.value };
  if (!canExecute.value) return { text: "Not a curator of this vault", disabled: true, hint: disabledReason.value };
  if (executorState.value === "checking") return { text: "Checking the executor…", disabled: true, loading: true };
  if (executorState.value !== "deployed") return { text: "Swap executor not deployed", disabled: true };
  if (!amount.value) return { text: "Enter an amount", disabled: true };
  if (insufficient.value) return { text: `Insufficient ${sellToken.value.symbol} balance`, disabled: true };
  if (!slippagePct.value) return { text: "Set a slippage between 0 and 50%", disabled: true };
  if (phase.value === "approving") return { text: `Approving ${sellToken.value.symbol}…`, disabled: true, loading: true };
  if (phase.value === "quoting") return { text: "Refreshing price…", disabled: true, loading: true };
  if (phase.value === "simulating") return { text: "Checking permissions…", disabled: true, loading: true };
  if (phase.value === "signing") return { text: "Confirm in your wallet", disabled: true, loading: true };
  if (phase.value === "pending") return { text: "Swapping…", disabled: true, loading: true };
  if (needsApproval.value) return { text: `Approve ${sellToken.value.symbol}`, disabled: false, action: approve };
  if (quoting.value && !quote.value) return { text: "Finding the best price…", disabled: true, loading: true };
  if (!quote.value) return { text: "No route", disabled: true, hint: quoteError.value };
  return { text: "Swap", disabled: false, action: swap };
});

/**
 * A send that did not go out, or came back rejected. A declined signature
 * is the operator's decision, not an error to show.
 */
const failed = (err: any) => {
  console.error(err);
  const message = err?.innerError?.message || err?.message || "";
  const declined =
    err?.code === 4001 || err?.innerError?.code === 4001 || /user (denied|rejected)/i.test(message);
  error.value = declined ? "" : message || "There has been an error.";
  phase.value = "idle";
};

/** Sign one call and wait for its receipt; the hash lands in `txHash` on the way. */
const sendAndWait = (inner: IndefiInner): Promise<boolean> =>
  new Promise((resolve) => {
    phase.value = "signing";
    // Not awaited: the emitter comes back synchronously, and awaiting a
    // PromiEvent yields the receipt, with no .on() left to register on.
    sendCuratorTransaction({ to: inner.to, data: inner.data }, INDEFI_ROUTE)
      .on("transactionHash", (hash: any) => {
        txHash.value = hash;
        phase.value = "pending";
      })
      .on("receipt", (receipt: any) => {
        if (!receipt.status) error.value = "The transaction reverted on chain.";
        resolve(!!receipt.status);
      })
      .catch((err: any) => {
        failed(err);
        resolve(false);
      });
  });

const ensureChain = async () => {
  if (!accountStore.connectedWalletWeb3) throw new Error("Connect your wallet.");
  // Every address on this screen is a Base one; the same calldata sent on
  // another chain would land on whatever sits at those addresses there.
  if (accountStore.connectedWalletChainId !== INDEFI.CHAIN) {
    await accountStore.switchNetwork(INDEFI.CHAIN);
  }
};

const approve = async () => {
  if (busy.value) return;
  error.value = "";
  lastSwap.value = null;
  try {
    await ensureChain();
    phase.value = "approving";
    const inner = indefiInner.approve(sellToken.value);
    const result = await simulateCuratorTransaction({ to: inner.to, data: inner.data }, INDEFI_ROUTE);
    if (!result.ok && !result.innerRevert) {
      throw new Error(result.reason || "The Roles modifier denied the approval.");
    }
    const ok = await sendAndWait(inner);
    if (ok) await refreshState();
  } catch (err: any) {
    failed(err);
  } finally {
    phase.value = "idle";
    txHash.value = "";
  }
};

/** Re-price if stale, re-check the balance, dry-run, sign, wait. */
const swap = async () => {
  if (busy.value || !quote.value) return;
  error.value = "";
  lastSwap.value = null;
  const sell = sellToken.value;
  const buy = buyToken.value;
  try {
    await ensureChain();

    let current = quote.value;
    if (Date.now() - current.at > QUOTE_TTL_MS) {
      phase.value = "quoting";
      current = await fetchQuote(sell, buy, current.amountIn, slippagePct.value ?? 1);
      quote.value = current;
    }

    const held = await indefiSafeBalance(sell);
    if (held < current.amountIn) {
      throw new Error(`The Safe holds ${fmtUnits(held, sell.decimals, 6)} ${sell.symbol}, less than this swap sells.`);
    }

    // Dry-run before the wallet opens. A permission denial is fatal — the
    // modifier would reject it after signing anyway.
    phase.value = "simulating";
    const result = await simulateCuratorTransaction(
      { to: current.inner.to, data: current.inner.data },
      INDEFI_ROUTE,
    );
    if (!result.ok && !result.innerRevert) {
      throw new Error(result.reason || "The Roles modifier denied this swap.");
    }
    if (result.innerRevert) {
      throw new Error("The swap would revert right now — the price moved past your slippage. Refresh and try again.");
    }

    const ok = await sendAndWait(current.inner);
    if (ok) {
      lastSwap.value = {
        sold: `${fmtUnits(current.amountIn, sell.decimals, 6)} ${sell.symbol}`,
        bought: `≥ ${fmtUnits(current.minReturn, buy.decimals, 6)} ${buy.symbol}`,
        hash: txHash.value,
      };
      amountText.value = "";
      quote.value = null;
      await refreshState();
    }
  } catch (err: any) {
    failed(err);
  } finally {
    phase.value = "idle";
    txHash.value = "";
  }
};

const copyText = (text: string, message: string) => {
  navigator.clipboard
    ?.writeText(text)
    .then(() => toastStore.successToast(message))
    .catch(() => toastStore.errorToast("Could not copy to the clipboard."));
};

onMounted(async () => {
  await Promise.all([
    refreshState(),
    readExecutorState(INDEFI.CHAIN).then((s) => (executorState.value = s)),
  ]);
});
</script>

<style scoped lang="scss">
/* One card, the width a swap widget is: everything the trade needs and nothing else. */
.ndfi {
  display: flex;
  justify-content: center;
  margin-bottom: 2.5rem;
}

.ndfi_card {
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;
}

/* The two amount boxes. */
.ndfi_box {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem 1rem 0.875rem;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  background: $color-card-background;
  transition: border-color $default-transition-time ease;

  &--focus {
    border-color: $color-cyan-line;
  }

  &__label {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  &__meta {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    font-family: $font-mono;
    font-size: 11.5px;
    color: $color-steel-blue;
    min-height: 1.1em;
  }

  &__balance {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    white-space: nowrap;
  }
}

/* The amount itself: big, mono, tabular — the figure the whole card is about.
   The app sets a 2.5rem min-height and a padding on every bare input, so all
   of those are unset here. */
.ndfi_amount {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  height: auto;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  font-family: $font-mono;
  font-size: 34px;
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 1.1;
  color: $color-white;
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &::placeholder {
    color: $color-steel-blue;
  }

  &--muted {
    color: $color-steel-blue;
  }

  &--loading {
    animation: ndfi_pulse 1.2s ease-in-out infinite;
  }
}

@keyframes ndfi_pulse {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 0.9;
  }
}

.ndfi_impact {
  font-style: normal;
  margin-left: 0.3rem;

  &--bad {
    color: $color-neg;
  }
}

.ndfi_max {
  font-family: $font-mono;
  font-size: 10.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: $color-cyan;
  background: $color-cyan-tint;
  border: 1px solid $color-cyan-line;
  border-radius: $default-border-radius;
  padding: 0.1rem 0.45rem;
  cursor: pointer;
}

/* Token pill and its menu. */
.ndfi_picker {
  position: relative;
  flex: 0 0 auto;
}

.ndfi_token {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.6rem 0.35rem 0.4rem;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  background: $color-dark;
  color: $color-white;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color $default-transition-time ease;

  &:hover {
    border-color: $color-cyan-line;
  }

  &__chevron {
    font-size: 11px;
    color: $color-steel-blue;
  }
}

.ndfi_menu {
  position: absolute;
  right: 0;
  top: calc(100% + 0.4rem);
  z-index: 5;
  min-width: 220px;
  padding: 0.35rem;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  background: $color-dark;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);

  &__item {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    padding: 0.5rem 0.6rem;
    border: 0;
    border-radius: $default-border-radius;
    background: transparent;
    color: $color-white;
    text-align: left;
    cursor: pointer;

    &:hover,
    &--on {
      background: $color-gray-light-transparent;
    }
  }

  &__symbol {
    font-size: 14px;
    font-weight: 600;
  }

  &__balance {
    font-family: $font-mono;
    font-size: 11.5px;
    color: $color-steel-blue;
    font-variant-numeric: tabular-nums;
  }
}

/* The flip control sits on the seam between the two boxes. */
.ndfi_flip_row {
  display: flex;
  justify-content: center;
  height: 0;
  position: relative;
  z-index: 2;
}

.ndfi_flip {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  margin-top: -18px;
  border: 4px solid $color-dark;
  border-radius: $default-border-radius;
  background: $color-card-background;
  color: $color-white;
  cursor: pointer;
  transition: color $default-transition-time ease, transform $default-transition-time ease;

  &:hover {
    color: $color-cyan;
    transform: rotate(180deg);
  }
}

/* Price and route, folded away until wanted. */
.ndfi_summary {
  border: 1px solid $color-line;
  border-radius: $default-border-radius;
  padding: 0.6rem 0.85rem;

  summary {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    list-style: none;
    cursor: pointer;
    font-family: $font-mono;
    font-size: 12px;
    color: $color-white;

    &::-webkit-details-marker {
      display: none;
    }
  }

  &__rate {
    flex: 1 1 auto;
  }

  &__age {
    font-size: 10.5px;
    color: $color-steel-blue;
  }

  &__chevron {
    font-size: 11px;
    color: $color-steel-blue;
    transition: transform $default-transition-time ease;
  }

  &[open] &__chevron {
    transform: rotate(180deg);
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-top: 0.75rem;
    margin-top: 0.6rem;
    border-top: 1px solid $color-line;
  }
}

.ndfi_kv {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-family: $font-mono;
  font-size: 12px;

  > span:first-child {
    color: $color-steel-blue;
    flex: 0 0 auto;
  }

  > span:last-child {
    color: $color-white;
    text-align: right;
    word-break: break-word;
  }

  &--stack > span:last-child {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    color: $color-steel-blue;
  }

  &--control > span:last-child {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
}

.ndfi_slippage {
  width: 46px;
  min-height: 0;
  height: 24px;
  padding: 0 0.35rem;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  background: $color-card-background;
  color: $color-white;
  font-family: $font-mono;
  font-size: 12px;
  text-align: right;
  outline: none;

  &:focus {
    border-color: $color-cyan-line;
  }
}

.ndfi_link {
  align-self: flex-start;
  padding: 0;
  border: 0;
  background: none;
  font-family: $font-mono;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: $color-cyan;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.ndfi_notice {
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  padding: 0.6rem 0.85rem;
  font-size: 12.5px;
  line-height: 1.5;
  color: $color-steel-blue;

  &--bad {
    border-color: $color-neg-line;
    background: $color-neg-soft;
    color: $color-neg;
  }
}

/* The one button. Taller than the app's small actions, as the thing the
   whole card leads to; its corners are the app's own. */
.ndfi_cta.v-btn {
  height: 52px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
  margin-top: 0.25rem;
}

.ndfi_done,
.ndfi_pending {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: $font-mono;
  font-size: 12px;
  color: $color-cyan;

  a {
    color: $color-cyan;
    text-decoration: underline;
  }
}

.ndfi_pending {
  color: $color-steel-blue;
  justify-content: center;

  a {
    color: $color-steel-blue;
  }
}
</style>
