<template>
  <div class="ndfi_console">
    <!--
      Headline value, laid out as the vault overview's stat strip: what the
      Safe holds, carried at display size on the left, each asset beside it.
      No card — it reads as page furniture.
    -->
    <div class="ndfi_summary">
      <div class="ndfi_summary__hero">
        <div class="ndfi_label ndfi_label--accent">
          Safe holdings
        </div>
        <div class="ndfi_summary__value_row">
          <span class="ndfi_summary__figure">{{ state ? fmtUsd(state.totalUsd) : "—" }}</span>
          <span class="ndfi_summary__unit">USD</span>
        </div>
      </div>

      <div class="ndfi_summary__divider" />

      <div class="ndfi_summary__breakdown">
        <div v-for="holding in holdings" :key="holding.token.symbol" class="ndfi_stat">
          <div class="ndfi_label ndfi_stat__asset">
            <img
              v-if="getDesignTokenIcon(holding.token.symbol)"
              :src="getDesignTokenIcon(holding.token.symbol)"
              :alt="holding.token.symbol"
              class="ndfi_mark"
            >
            {{ holding.token.symbol }}
          </div>
          <div class="ndfi_stat__value">
            {{ fmtUnits(holding.balance, holding.token.decimals, holding.token.decimals === 6 ? 2 : 4) }}
          </div>
          <div class="ndfi_stat__sub">
            {{ holding.price ? "$" + fmtUsd(holding.usd) : "no price" }}
          </div>
        </div>
      </div>

      <v-btn
        class="ndfi_summary__refresh"
        variant="outlined"
        size="small"
        :loading="loadingState"
        @click="refresh"
      >
        Refresh
      </v-btn>
    </div>

    <div class="ndfi_layout">
      <div class="ndfi_main">
        <div class="group_title ndfi_section">
          Swap
        </div>

        <div class="brand_card ndfi_card">
          <div class="ndfi_form_row">
            <span class="ndfi_label">Sell</span>
            <div class="ndfi_form_row__controls">
              <select v-model="sellSymbol" class="ndfi_select">
                <option v-for="t in INDEFI_TOKENS" :key="t.symbol" :value="t.symbol">
                  {{ t.symbol }}
                </option>
              </select>
              <input
                v-model="amountText"
                class="ndfi_input ndfi_input--amount"
                inputmode="decimal"
                placeholder="0.00"
                spellcheck="false"
              >
              <button class="ndfi_text_btn" type="button" @click="setMax">
                Max
              </button>
            </div>
          </div>
          <div class="ndfi_form_hint">
            Available:
            <b>{{ fmtUnits(sellHolding?.balance ?? 0n, sellToken.decimals, sellToken.decimals === 6 ? 2 : 6) }} {{ sellToken.symbol }}</b>
            <template v-if="amount && sellHolding?.price">
              · ≈ ${{ fmtUsd(Number(ethers.formatUnits(amount, sellToken.decimals)) * sellHolding.price) }}
            </template>
          </div>

          <div class="ndfi_form_row">
            <span class="ndfi_label">Buy</span>
            <div class="ndfi_form_row__controls">
              <select v-model="buySymbol" class="ndfi_select">
                <option v-for="t in buyOptions" :key="t.symbol" :value="t.symbol">
                  {{ t.symbol }}
                </option>
              </select>
              <span class="ndfi_form_hint ndfi_form_hint--inline">
                proceeds go to the Safe {{ shortAddress(INDEFI.ADDR.safe) }}
              </span>
            </div>
          </div>

          <div class="ndfi_form_row">
            <span class="ndfi_label">Max slippage</span>
            <div class="ndfi_form_row__controls">
              <input
                v-model="slippage"
                class="ndfi_input ndfi_input--short"
                inputmode="decimal"
                spellcheck="false"
              >
              <span class="ndfi_input__unit">%</span>
              <span class="ndfi_form_hint ndfi_form_hint--inline">
                sets the floor the router refuses to fill below
              </span>
            </div>
          </div>

          <div class="ndfi_source" :class="'ndfi_source--' + executorState">
            <span class="ndfi_dot" />
            <span>{{ executorStatusText }}</span>
          </div>

          <div v-for="problem in formProblems" :key="problem" class="ndfi_warn">
            {{ problem }}
          </div>

          <div class="ndfi_row ndfi_row--end">
            <v-btn
              class="bg-primary text-secondary"
              size="small"
              :loading="building"
              :disabled="!canBuild"
              @click="buildRoute"
            >
              {{ executorState === "deployed" ? "Find route" : "Prepare swap" }}
            </v-btn>
          </div>
        </div>

        <div class="brand_card ndfi_card ndfi_notes">
          <div class="brand_card__eyebrow">
            How this executes
          </div>
          <div class="ndfi_card__sub">
            No aggregator API. The console asks the Uniswap V3 and Aerodrome
            Slipstream factories which pools trade the pair, prices every
            candidate by simulating the exact swap from the Safe, and builds the
            best one as a 1inch <code>swap()</code> — the one router entry point
            role 1 may use — whose executor is Rethink's own
            ({{ shortAddress(SWAP_EXECUTOR.address) }}): a stateless contract
            that runs the named pool route and hands the output back to the
            router.
          </div>
          <div class="ndfi_card__sub">
            The router still enforces the floor (<code>minReturn</code>, your
            slippage against the live quote) and delivers to the Safe; the
            whitelist still pins the receiver and the bought token. Every swap
            is checked against both before your wallet opens, and a quote older
            than a minute is rebuilt before signing.
          </div>
          <div class="ndfi_card__sub">
            Signed from your manager wallet, the call goes through the Roles
            modifier ({{ shortAddress(INDEFI.ADDR.roles) }}, role 1). Connected as
            the Safe itself, it goes out unwrapped — no Zodiac Pilot needed either
            way. Calldata built elsewhere can still be pasted.
          </div>
        </div>
      </div>

      <div class="ndfi_aside">
        <div class="group_title ndfi_section">
          Transaction plan
          <span v-if="steps.length" class="ndfi_section__action">
            <v-tooltip
              activator="parent"
              location="bottom"
              :disabled="!planButtonTitle"
            >
              <template #activator>
                <v-btn
                  class="bg-primary text-secondary"
                  size="small"
                  :loading="running"
                  :disabled="!canExecute || steps.some((s) => !isReady(s))"
                  @click="executePlan"
                >
                  Execute all
                </v-btn>
              </template>
              <template #default>
                {{ planButtonTitle }}
              </template>
            </v-tooltip>
          </span>
        </div>

        <div v-if="!steps.length" class="brand_card ndfi_panel ndfi_panel--empty">
          <p class="ndfi_panel__intro">
            No route built
          </p>
        </div>

        <template v-else>
          <div v-for="issue in issues" :key="issue" class="ndfi_warn">
            {{ issue }}
          </div>

          <div
            v-for="(step, i) in steps"
            :key="i"
            class="brand_card ndfi_card ndfi_step"
            :class="{ 'ndfi_step--done': step.status === 'ok', 'ndfi_step--busy': isBusy(step) }"
          >
            <div class="ndfi_step__head">
              <div class="ndfi_card__titles">
                <div class="brand_card__eyebrow">
                  {{ i + 1 }} · {{ step.label }}
                </div>
                <div class="ndfi_card__sub">
                  {{ stepStatusText(step) }}
                </div>
              </div>
              <div v-if="step.quote" class="ndfi_stat ndfi_stat--right">
                <div class="ndfi_label">
                  {{ step.quote.kind === "built" ? "Expected" : "Min. fill" }}
                </div>
                <div
                  class="ndfi_stat__value"
                  :class="step.quote.impactPct < -Number(slippage) ? 'ndfi_stat__value--bad' : ''"
                >
                  {{ fmtUnits(step.quote.amountOut, step.intent!.buy.decimals, 6) }} {{ step.intent!.buy.symbol }}
                </div>
                <div class="ndfi_stat__sub">
                  {{ step.quote.impactPct ? step.quote.impactPct.toFixed(2) + "% vs oracle" : "no oracle mark" }}
                </div>
              </div>
            </div>

            <div v-for="p in step.inner?.params ?? []" :key="p.k" class="ndfi_param">
              <span>{{ p.k }}</span>
              <span>{{ p.v }}<em v-if="p.pinned" class="ndfi_pinned"> · pinned</em></span>
            </div>

            <!-- The routes that lost, so the choice can be checked. -->
            <div v-if="step.quote?.alternatives.length" class="ndfi_alts">
              <div class="ndfi_label">
                Also quoted
              </div>
              <div v-for="alt in step.quote.alternatives" :key="alt" class="ndfi_alts__row">
                {{ alt }}
              </div>
            </div>

            <!--
              A swap leg carries no calldata until a route has been built for
              it. When the executor is not on this chain, or no pool can price
              the trade, the operator can bring calldata built elsewhere —
              everything it has to match is spelled out here.
            -->
            <div v-if="step.intent && !step.inner" class="ndfi_paste">
              <div class="ndfi_card__sub">
                Paste <code>swap</code> calldata for this leg (receiver = the
                Safe, partial fills off).
              </div>
              <div class="ndfi_paste__intent">
                <div><span>sell</span><span>{{ fmtUnits(step.intent.amount, step.intent.sell.decimals, 6) }} {{ step.intent.sell.symbol }}</span></div>
                <div><span>buy</span><span>{{ step.intent.buy.symbol }}</span></div>
                <div><span>receiver</span><span>{{ INDEFI.ADDR.safe }}</span></div>
              </div>
              <textarea
                v-model="step.paste"
                class="ndfi_paste__input"
                rows="3"
                spellcheck="false"
                placeholder="0x07ed2379…"
                @input="applyCalldata(step)"
              />
              <div v-for="problem in step.problems" :key="problem" class="ndfi_warn">
                {{ problem }}
              </div>
            </div>

            <div v-if="step.quote?.kind === 'built'" class="ndfi_quote_age">
              <span>{{ quoteAgeText(step.quote) }}</span>
              <button
                class="ndfi_text_btn"
                type="button"
                :disabled="isBusy(step) || step.status === 'ok'"
                @click="requote(step)"
              >
                Refresh route
              </button>
            </div>

            <details v-if="step.inner" class="ndfi_details">
              <summary>
                <template v-if="isConnectedAsSafe">
                  Calldata · from the Safe to {{ shortAddress(step.inner?.to) }} ·
                  unwrapped
                </template>
                <template v-else>
                  Calldata · to Roles {{ shortAddress(INDEFI.ADDR.roles) }} ·
                  execTransactionWithRole(role {{ INDEFI.ROLE }})
                  {{ indefiValidateWrapped(step.wrapped) ? "· 0x6928e74b ✓" : "· BAD PREFIX" }}
                </template>
              </summary>
              <div class="ndfi_hex">
                {{ sentCalldata(step) }}
              </div>
              <v-btn
                variant="text"
                size="small"
                class="ndfi_text_action"
                @click="copyText(sentCalldata(step), 'Calldata copied.')"
              >
                Copy calldata
              </v-btn>
            </details>

            <div v-if="step.error" class="ndfi_warn">
              {{ step.error }}
            </div>

            <div class="ndfi_step__actions">
              <a
                v-if="step.txHash"
                :href="INDEFI.EXPLORER + '/tx/' + step.txHash"
                target="_blank"
                rel="noopener noreferrer"
                :class="step.status === 'ok' ? 'ndfi_ok' : 'ndfi_mono_dim'"
              >
                {{ step.status === "ok" ? "✓ mined · view" : shortAddress(step.txHash) }}
              </a>
              <span>
                <v-tooltip
                  activator="parent"
                  location="bottom"
                  :disabled="!planButtonTitle"
                >
                  <template #activator>
                    <v-btn
                      class="bg-primary text-secondary"
                      size="small"
                      :loading="isBusy(step)"
                      :disabled="!canExecute || !isReady(step) || step.status === 'ok' || running"
                      @click="runStep(step)"
                    >
                      {{ step.status === "ok" ? "Done" : step.status === "failed" ? "Retry" : "Execute" }}
                    </v-btn>
                  </template>
                  <template #default>
                    {{ planButtonTitle }}
                  </template>
                </v-tooltip>
              </span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { getDesignTokenIcon } from "~/composables/designSystemIcons";
import {
  INDEFI,
  INDEFI_SWAP_RULES,
  INDEFI_TOKENS,
  fmtUnits,
  fmtUsd,
  indefiInner,
  indefiReadState,
  indefiSafeBalance,
  indefiValidateWrapped,
  indefiWrappedPreview,
  parseAmount,
  type IndefiHolding,
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
} from "~/composables/execution/onchainSwap";
import {
  parseOneInchSwap,
  shortAddress,
  swapImpactPct,
  validateOneInchSwap,
  type OneInchSwapIntent,
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
/** A built route older than this is rebuilt before it is signed. */
const QUOTE_TTL_MS = 60_000;

const state = ref<IndefiState | null>(null);
const loadingState = ref(false);
const building = ref(false);
const running = ref(false);

const executorState = ref<ExecutorState | "checking">("checking");
const executorStatusText = computed(() => {
  switch (executorState.value) {
    case "deployed":
      return `Route source: on-chain quotes through the Rethink swap executor ${shortAddress(SWAP_EXECUTOR.address)} — Uniswap V3 and Aerodrome Slipstream pools, no aggregator API`;
    case "missing":
      return `The Rethink swap executor is not deployed on Base yet (${shortAddress(SWAP_EXECUTOR.address)}) — swaps can still be executed from pasted swap() calldata`;
    case "foreign":
      return `The code at ${shortAddress(SWAP_EXECUTOR.address)} is not the audited swap executor — routing is off; pasted swap() calldata only`;
    case "unreachable":
      return "No Base RPC answered — swaps can still be executed from pasted swap() calldata";
    default:
      return "Checking the swap executor…";
  }
});

/* -------------------------------------------------------------------------- */
/* Form                                                                        */
/* -------------------------------------------------------------------------- */

const sellSymbol = ref("USDC");
const buySymbol = ref("WETH");
const amountText = ref("");
const slippage = ref("1");

const tokenBySymbol = (symbol: string): IndefiToken =>
  INDEFI_TOKENS.find((t) => t.symbol === symbol) ?? INDEFI_TOKENS[0];
const sellToken = computed(() => tokenBySymbol(sellSymbol.value));
const buyToken = computed(() => tokenBySymbol(buySymbol.value));
const buyOptions = computed(() => INDEFI_TOKENS.filter((t) => t.symbol !== sellSymbol.value));

// Selling what was being bought flips the pair rather than leaving the two
// selects pointing at the same asset.
watch(sellSymbol, (next, previous) => {
  if (buySymbol.value === next) buySymbol.value = previous;
});

const holdings = computed<IndefiHolding[]>(() => state.value?.holdings ?? []);
const holdingOf = (token: IndefiToken) =>
  holdings.value.find((h) => h.token.symbol === token.symbol);
const sellHolding = computed(() => holdingOf(sellToken.value));
const priceOf = (token: IndefiToken) => holdingOf(token)?.price ?? 0;

const amount = computed(() => parseAmount(amountText.value, sellToken.value.decimals));
const slippagePct = computed(() => {
  const value = Number(slippage.value);
  return Number.isFinite(value) && value > 0 && value <= 50 ? value : null;
});

const formProblems = computed(() => {
  const problems: string[] = [];
  if (amountText.value.trim() && !amount.value) {
    problems.push(
      `Enter a positive ${sellToken.value.symbol} amount with at most ${sellToken.value.decimals} decimals.`,
    );
  }
  if (amount.value && sellHolding.value && amount.value > sellHolding.value.balance) {
    problems.push(
      `The Safe holds ${fmtUnits(sellHolding.value.balance, sellToken.value.decimals, 6)} ${sellToken.value.symbol}, less than that.`,
    );
  }
  if (slippage.value.trim() && slippagePct.value === null) {
    problems.push("Max slippage must be a percentage between 0 and 50.");
  }
  return problems;
});

const canBuild = computed(
  () =>
    !!amount.value &&
    !!slippagePct.value &&
    !formProblems.value.length &&
    !!state.value &&
    executorState.value !== "checking",
);

const setMax = () => {
  const held = sellHolding.value?.balance ?? 0n;
  amountText.value = held > 0n ? ethers.formatUnits(held, sellToken.value.decimals) : "";
};

/* -------------------------------------------------------------------------- */
/* Plan                                                                        */
/* -------------------------------------------------------------------------- */

type StepStatus = "idle" | "quoting" | "simulating" | "signing" | "pending" | "ok" | "failed";

interface IndefiQuote {
  /** Built here from on-chain quotes, or read off pasted calldata. */
  kind: "built" | "pasted";
  /** Expected output when built; the calldata's own floor when pasted. */
  amountOut: bigint;
  /** Against Chainlink marks; negative means value given up. */
  impactPct: number;
  route: string;
  /** The candidates that priced worse, for the record. */
  alternatives: string[];
  at: number;
}

interface IndefiStep {
  kind: "approve" | "swap";
  label: string;
  /** What a swap has to do. Null on an approval. */
  intent: OneInchSwapIntent | null;
  quote: IndefiQuote | null;
  /** The operator's paste, and what is wrong with it. */
  paste: string;
  problems: string[];
  /** Null on a swap leg until its calldata arrives and validates. */
  inner: IndefiInner | null;
  wrapped: string;
  status: StepStatus;
  error: string;
  txHash: string | null;
}

const steps = ref<IndefiStep[]>([]);
const issues = ref<string[]>([]);

const makeStep = (
  kind: IndefiStep["kind"],
  label: string,
  inner: IndefiInner | null,
  intent: OneInchSwapIntent | null = null,
  quote: IndefiQuote | null = null,
): IndefiStep =>
  reactive({
    kind,
    label,
    intent,
    quote,
    paste: "",
    problems: [] as string[],
    inner,
    wrapped: inner ? indefiWrappedPreview(inner) : "",
    status: "idle" as StepStatus,
    error: "",
    txHash: null,
  }) as IndefiStep;

const isBusy = (step: IndefiStep) =>
  ["quoting", "simulating", "signing", "pending"].includes(step.status);
const isReady = (step: IndefiStep) => !!step.inner;

const stepStatusText = (step: IndefiStep) => {
  switch (step.status) {
    case "quoting":
      return "re-pricing against live pools…";
    case "simulating":
      return "checking the vault's permissions…";
    case "signing":
      return "waiting for your wallet…";
    case "pending":
      return "submitted, waiting for the block…";
    case "ok":
      return "done";
    default:
      if (step.intent && !step.inner) return "waiting for its calldata";
      return step.quote?.route || step.inner?.sig || "";
  }
};

const planButtonTitle = computed(() => {
  if (steps.value.some((s) => s.intent && !s.inner)) {
    return "The swap has no calldata yet.";
  }
  return disabledReason.value;
});

const sentCalldata = (step: IndefiStep) =>
  isConnectedAsSafe.value ? step.inner?.data ?? "" : step.wrapped;

// A ticking clock for the quote's age, only while there is a quote to age.
const now = ref(Date.now());
let clock: ReturnType<typeof setInterval> | undefined;
watch(
  () => steps.value.some((s) => s.quote?.kind === "built"),
  (ticking) => {
    if (clock) clearInterval(clock);
    clock = ticking ? setInterval(() => (now.value = Date.now()), 1000) : undefined;
  },
);
onBeforeUnmount(() => clock && clearInterval(clock));

const quoteAgeText = (quote: IndefiQuote) => {
  const seconds = Math.max(0, Math.round((now.value - quote.at) / 1000));
  return seconds < QUOTE_TTL_MS / 1000
    ? `Quoted ${seconds}s ago`
    : `Quoted ${seconds}s ago — rebuilt before signing`;
};

/* -------------------------------------------------------------------------- */
/* Building the route                                                          */
/* -------------------------------------------------------------------------- */

const checkExecutor = async () => {
  executorState.value = "checking";
  executorState.value = await readExecutorState(INDEFI.CHAIN);
};

/**
 * The best route the chain can offer right now: every pool the factories
 * know for the pair (and one hop through another vault asset), each priced
 * by simulating the identical swap from the Safe, the winner built as the
 * router call and held against the whitelist and the leg before it is shown.
 * Throws with the reason when any of that fails.
 */
const fetchBuilt = async (
  intent: OneInchSwapIntent,
): Promise<{ inner: IndefiInner; quote: IndefiQuote }> => {
  const routes = await discoverRoutes(
    INDEFI.CHAIN,
    BASE_VENUES,
    intent.sell,
    intent.buy,
    INDEFI_TOKENS,
  );
  if (!routes.length) {
    throw new Error(
      `No Uniswap V3 or Aerodrome Slipstream pool trades ${intent.sell.symbol} for ${intent.buy.symbol}.`,
    );
  }
  const quotes = await quoteRoutes(INDEFI.CHAIN, INDEFI.ADDR.safe, routes, intent.amount);
  if (!quotes.length) {
    throw new Error(
      `None of ${routes.length} candidate routes could fill ${fmtUnits(intent.amount, intent.sell.decimals, 6)} ${intent.sell.symbol} — the pools may be too thin for this size, or the Safe holds less than that.`,
    );
  }
  const best = quotes[0];
  const minReturn = minReturnFor(best.amountOut, slippagePct.value ?? 1);
  const { data } = buildExecutorSwap({
    safe: INDEFI.ADDR.safe,
    route: best.route,
    amountIn: intent.amount,
    minReturn,
    deadline: swapDeadline(),
  });
  const call = parseOneInchSwap(data);
  const problems = validateOneInchSwap(call, INDEFI_SWAP_RULES, intent, 0);
  if (call.executor.toLowerCase() !== SWAP_EXECUTOR.address.toLowerCase()) {
    problems.push("The built swap does not name the Rethink executor.");
  }
  if (problems.length) {
    throw new Error(`The built calldata cannot be sent: ${problems.join(" ")}`);
  }
  const quote: IndefiQuote = {
    kind: "built",
    amountOut: best.amountOut,
    impactPct: swapImpactPct(
      intent.amount,
      intent.sell,
      priceOf(intent.sell as IndefiToken),
      best.amountOut,
      intent.buy,
      priceOf(intent.buy as IndefiToken),
    ),
    route: best.route.label,
    alternatives: quotes
      .slice(1, 4)
      .map((q) => `${q.route.label}: ${fmtUnits(q.amountOut, intent.buy.decimals, 6)} ${intent.buy.symbol}`),
    at: Date.now(),
  };
  const inner = indefiInner.swap(call, data, intent.sell, intent.buy, best.route.label);
  return { inner, quote };
};

const buildRoute = async () => {
  if (!amount.value || !slippagePct.value) return;
  building.value = true;
  steps.value = [];
  issues.value = [];
  try {
    const sell = sellToken.value;
    const buy = buyToken.value;
    const intent: OneInchSwapIntent = { sell, buy, amount: amount.value };
    const list: IndefiStep[] = [];

    // Whatever the trade spends has to be spendable first. Today's
    // allowances are all unlimited, so this normally adds nothing — but a
    // revoked one would otherwise surface as an opaque inner revert.
    if ((sellHolding.value?.oneInchAllowance ?? 0n) < LARGE_ALLOWANCE) {
      list.push(
        makeStep("approve", `Approve ${sell.symbol} for the 1inch router`, indefiInner.approve(sell)),
      );
    }

    const label = `Swap ${fmtUnits(amount.value, sell.decimals, 6)} ${sell.symbol} for ${buy.symbol}`;
    if (executorState.value === "deployed") {
      try {
        const { inner, quote } = await fetchBuilt(intent);
        list.push(makeStep("swap", label, inner, intent, quote));
      } catch (error: any) {
        console.error(error);
        issues.value.push(error?.message || "The route could not be built.");
        list.push(makeStep("swap", label, null, intent));
      }
    } else {
      list.push(makeStep("swap", label, null, intent));
    }
    steps.value = list;
  } finally {
    building.value = false;
  }
};

/**
 * Take the operator's paste and either turn it into this step's calldata or
 * say exactly why it is not this step's calldata. Both the permission's rules
 * and the leg's own numbers are checked here, so nothing that would revert in
 * the modifier ever reaches a wallet prompt.
 */
const applyCalldata = (step: IndefiStep) => {
  step.inner = null;
  step.wrapped = "";
  step.quote = null;
  step.error = "";
  const hex = step.paste.trim();
  if (!hex || !step.intent) {
    step.problems = [];
    return;
  }
  let call;
  try {
    call = parseOneInchSwap(hex);
  } catch (error: any) {
    step.problems = [error?.message ?? "That calldata could not be read."];
    return;
  }
  step.problems = validateOneInchSwap(call, INDEFI_SWAP_RULES, step.intent);
  if (step.problems.length) return;
  step.inner = indefiInner.swap(call, hex, step.intent.sell, step.intent.buy);
  step.wrapped = indefiWrappedPreview(step.inner);
  step.quote = {
    kind: "pasted",
    amountOut: call.minReturn,
    impactPct: swapImpactPct(
      call.amount,
      step.intent.sell,
      priceOf(step.intent.sell as IndefiToken),
      call.minReturn,
      step.intent.buy,
      priceOf(step.intent.buy as IndefiToken),
    ),
    route: `program of ${(call.program.length - 2) / 2} bytes, executor ${shortAddress(call.executor)}`,
    alternatives: [],
    at: Date.now(),
  };
};

/** A fresh route and floor for a built swap, in place. */
const requote = async (step: IndefiStep): Promise<boolean> => {
  if (!step.intent || step.quote?.kind !== "built") return true;
  step.status = "quoting";
  step.error = "";
  try {
    const { inner, quote } = await fetchBuilt(step.intent);
    step.inner = inner;
    step.wrapped = indefiWrappedPreview(inner);
    step.quote = quote;
    step.status = "idle";
    return true;
  } catch (error: any) {
    console.error(error);
    step.status = "failed";
    step.error = `The route could not be rebuilt: ${error?.message || "unknown error"}`;
    return false;
  }
};

/* -------------------------------------------------------------------------- */
/* Running a step                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The size is re-checked against what the Safe holds immediately before
 * signing: nothing stops the balance from having moved since the plan was
 * built.
 */
const recheckBalance = async (step: IndefiStep): Promise<boolean> => {
  if (!step.intent) return true;
  const held = await indefiSafeBalance(step.intent.sell as IndefiToken);
  if (held < step.intent.amount) {
    step.error = `The Safe holds ${fmtUnits(held, step.intent.sell.decimals, 6)} ${step.intent.sell.symbol}, less than this swap sells.`;
    return false;
  }
  return true;
};

/**
 * Dry-run before the wallet opens. A permission denial is fatal — the modifier
 * would reject it after signing anyway. An inner revert is not: eth_call sees
 * only current state, so a swap staged behind an unmined approve reads as
 * failing and then succeeds.
 */
const preflight = async (step: IndefiStep): Promise<boolean> => {
  step.status = "simulating";
  if (!step.inner) {
    step.error = "This leg has no calldata yet.";
    return false;
  }
  const result = await simulateCuratorTransaction(
    { to: step.inner.to, data: step.inner.data },
    INDEFI_ROUTE,
  );
  if (result.ok || result.innerRevert) return true;
  step.error = result.reason || "The Roles modifier denied this call.";
  return false;
};

/**
 * A send that did not go out, or came back rejected. A declined signature
 * is the operator's decision, not an error to show.
 */
const sendFailed = (step: IndefiStep, error: any): false => {
  console.error(error);
  const message = error?.innerError?.message || error?.message || "";
  const declined =
    error?.code === 4001 ||
    error?.innerError?.code === 4001 ||
    /user (denied|rejected)/i.test(message);
  step.status = "failed";
  step.error = declined ? "" : message || "There has been an error.";
  return false;
};

const send = (step: IndefiStep): Promise<boolean> =>
  new Promise((resolve) => {
    step.status = "signing";
    // preflight() has already refused a step without calldata.
    const inner = step.inner!;
    // Not awaited: the emitter comes back synchronously, and awaiting a
    // PromiEvent yields the receipt, with no .on() left to register on.
    sendCuratorTransaction({ to: inner.to, data: inner.data }, INDEFI_ROUTE)
      .on("transactionHash", (hash: any) => {
        step.txHash = hash;
        step.status = "pending";
      })
      .on("receipt", (receipt: any) => {
        step.status = receipt.status ? "ok" : "failed";
        if (!receipt.status) step.error = "The transaction reverted on chain.";
        resolve(!!receipt.status);
      })
      // One handler for both a send that never went out (a refused network
      // switch, no provider) and one that was rejected or reverted: the
      // PromiEvent rejects in every case.
      .catch((error: any) => resolve(sendFailed(step, error)));
  });

/** Re-price if stale, re-check, dry-run, sign, wait — one step behind one press. */
const runStep = async (step: IndefiStep): Promise<boolean> => {
  if (step.status === "ok") return true;
  if (!accountStore.connectedWalletWeb3) {
    toastStore.errorToast("Connect your wallet.");
    return false;
  }
  step.error = "";
  try {
    // Every address on this screen is a Base one; the same calldata sent on
    // another chain would land on whatever sits at those addresses there.
    if (accountStore.connectedWalletChainId !== INDEFI.CHAIN) {
      await accountStore.switchNetwork(INDEFI.CHAIN);
    }
    if (step.quote?.kind === "built" && Date.now() - step.quote.at > QUOTE_TTL_MS) {
      if (!(await requote(step))) return false;
    }
    if (!(await recheckBalance(step)) || !(await preflight(step))) {
      step.status = "failed";
      return false;
    }
    const ok = await send(step);
    if (ok) await refresh();
    return ok;
  } catch (error: any) {
    console.error(error);
    step.status = "failed";
    step.error = error?.message || "There has been an error.";
    return false;
  }
};

/** The whole plan, in order, stopping at the first step that does not land. */
const executePlan = async () => {
  running.value = true;
  try {
    for (const step of steps.value) {
      if (step.status === "ok") continue;
      if (!(await runStep(step))) {
        toastStore.errorToast(
          step.error || "The plan stopped at a step that did not go through.",
          12000,
        );
        return;
      }
    }
    toastStore.successToast("The swap is done.");
  } finally {
    running.value = false;
  }
};

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

const refresh = async () => {
  loadingState.value = true;
  try {
    state.value = await indefiReadState();
  } catch (error: any) {
    console.error(error);
    toastStore.errorToast(error?.message || "Could not read the Safe's holdings.");
  } finally {
    loadingState.value = false;
  }
};

const copyText = (text: string, message: string) => {
  navigator.clipboard
    ?.writeText(text)
    .then(() => toastStore.successToast(message))
    .catch(() => toastStore.errorToast("Could not copy to the clipboard."));
};

onMounted(() => {
  refresh();
  checkExecutor();
});
</script>

<style scoped lang="scss">
.ndfi_console {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  margin-bottom: 2.5rem;
}

/* The mono uppercase caption the whole design system labels figures with. */
.ndfi_label {
  font-family: $font-mono;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: $color-steel-blue;

  &--accent {
    letter-spacing: 0.16em;
    color: $color-cyan;
  }
}

.ndfi_mark {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  vertical-align: -2px;
  margin-right: 0.3rem;
}

/**
 * Headline value. Same construction as the vault overview's stat strip — hero
 * figure keeping the left edge, hairline divider pushing the derived numbers
 * away from it, no card behind any of it.
 */
.ndfi_summary {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 1.5rem 2rem;

  &__hero {
    display: flex;
    flex-direction: column;
    gap: 0.8125rem;
  }

  &__value_row {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  &__figure {
    font-family: $font-mono;
    font-size: clamp(30px, 3.4vw, 42px);
    font-weight: 500;
    letter-spacing: -0.025em;
    line-height: 0.95;
    color: $color-white;
    font-variant-numeric: tabular-nums;
  }

  &__unit {
    font-family: $font-mono;
    font-size: 17px;
    color: $color-text-irrelevant;
  }

  &__divider {
    display: none;
    width: 1px;
    align-self: stretch;
    background: $color-line;

    @media (min-width: 1100px) {
      display: block;
      margin-left: auto;
    }
  }

  &__breakdown {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 1rem 1.75rem;
  }

  &__refresh {
    align-self: flex-end;
  }
}

.ndfi_stat {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0;

  &--right {
    text-align: right;
    flex: 0 0 auto;
  }

  &__asset {
    display: inline-flex;
    align-items: center;
  }

  &__value {
    font-family: $font-mono;
    font-size: 15px;
    color: $color-white;
    font-variant-numeric: tabular-nums;

    &--bad {
      color: $color-neg;
    }
  }

  &__sub {
    font-family: $font-mono;
    font-size: 11px;
    color: $color-steel-blue;
  }
}

/**
 * Group heading. Type comes from the global .group_title; this only adds the
 * space a heading needs above the cards it introduces.
 */
.ndfi_section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.75rem;

  &:first-child {
    margin-top: 0;
  }

  &__action {
    margin-left: auto;
  }
}

/**
 * The form on the left, the transactions it produces on the right — the same
 * split the other consoles use, so the thing being edited and the thing being
 * signed never trade places.
 */
.ndfi_layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 440px;
  gap: 1.75rem;
  align-items: start;

  @media (max-width: 1240px) {
    grid-template-columns: 1fr;
  }
}

.ndfi_main,
.ndfi_aside {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

/* .brand_card supplies the chrome; this is only the internal rhythm. */
.ndfi_card {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;

  &__titles {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
    flex: 1 1 auto;
  }

  &__sub {
    font-size: 12.5px;
    line-height: 1.5;
    color: $color-steel-blue;

    code {
      font-family: $font-mono;
      font-size: 11.5px;
      color: $color-text-irrelevant;
    }

    b {
      font-family: $font-mono;
      color: $color-white;
    }
  }
}

.ndfi_notes {
  gap: 0.625rem;
}

/* One row of the form: caption on the left, its controls on the right. */
.ndfi_form_row {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;

  &__controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    min-width: 0;
  }

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
    gap: 0.375rem;
  }
}

.ndfi_form_hint {
  font-family: $font-mono;
  font-size: 11px;
  color: $color-steel-blue;
  margin-top: -0.375rem;

  b {
    color: $color-white;
    font-weight: 500;
  }

  &--inline {
    margin-top: 0;
  }
}

/* The design's inset field. The app sets a 2.5rem min-height and a padding on
   every bare input, so all three are set together here. */
.ndfi_input,
.ndfi_select {
  min-height: 0;
  height: 34px;
  padding: 0 0.625rem;
  background: $color-card-background;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  color: $color-white;
  font-family: $font-mono;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  outline: none;
  transition: border-color $default-transition-time ease;

  &::placeholder {
    color: $color-steel-blue;
  }

  &:focus {
    border-color: $color-cyan-line;
  }
}

.ndfi_input {
  width: 100%;
  max-width: 220px;
  text-align: right;

  &--amount {
    flex: 1 1 140px;
  }

  &--short {
    width: 72px;
    flex: 0 0 auto;
  }

  &__unit {
    font-family: $font-mono;
    font-size: 11px;
    color: $color-steel-blue;
  }
}

.ndfi_select {
  width: 104px;
  flex: 0 0 auto;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, $color-steel-blue 50%),
    linear-gradient(135deg, $color-steel-blue 50%, transparent 50%);
  background-position: calc(100% - 14px) 14px, calc(100% - 9px) 14px;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  padding-right: 1.5rem;

  option {
    color: $color-dark;
  }
}

.ndfi_text_btn {
  font-family: $font-mono;
  font-size: 10.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: $color-cyan;
  background: none;
  border: 0;
  padding: 0.25rem 0.25rem;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    text-decoration: none;
  }
}

/* Where the route comes from, said as a status line with a state marker. */
.ndfi_source {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: $font-mono;
  font-size: 11px;
  line-height: 1.4;
  color: $color-steel-blue;

  .ndfi_dot {
    background: $color-steel-blue;
  }

  &--ready .ndfi_dot {
    background: $color-cyan;
  }

  &--unconfigured .ndfi_dot,
  &--unreachable .ndfi_dot {
    background: $color-neg;
  }
}

.ndfi_dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: 0 0 auto;
}

.ndfi_row {
  display: flex;
  gap: 0.625rem;
  align-items: center;
  flex-wrap: wrap;

  &--end {
    justify-content: flex-end;
  }
}

.ndfi_panel {
  &--empty {
    min-height: 140px;
    display: grid;
    align-content: center;
  }

  &__intro {
    margin: 0;
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-align: center;
    color: $color-steel-blue;
  }
}

.ndfi_warn {
  border: 1px solid $color-neg-line;
  background: $color-neg-soft;
  border-radius: $default-border-radius;
  padding: 0.5625rem 0.75rem;
  font-size: 12.5px;
  line-height: 1.5;
  color: $color-neg;
}

.ndfi_step {
  transition: border-color $default-transition-time ease,
    opacity $default-transition-time ease;

  &--done {
    opacity: 0.55;
  }

  &--busy {
    border-color: $color-cyan-line;
  }

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: nowrap;
  }

  &__actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    align-items: center;
    flex-wrap: wrap;
  }
}

.ndfi_param {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-family: $font-mono;
  font-size: 12px;

  span:first-child {
    color: $color-steel-blue;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex: 0 0 auto;
  }

  span:last-child {
    text-align: right;
    word-break: break-word;
  }
}

.ndfi_pinned {
  font-style: normal;
  color: $color-text-irrelevant;
  font-size: 10.5px;
}

/* A leg that cannot run yet, marked as one. */
.ndfi_paste {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px dashed $color-line-3;
  border-radius: 0.5rem;

  &__intent {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-family: $font-mono;
    font-size: 0.75rem;

    > div {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
    }

    span:first-child {
      opacity: 0.6;
    }

    span:last-child {
      word-break: break-all;
      text-align: right;
    }
  }

  &__input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid $color-line-3;
    border-radius: 0.375rem;
    background: $color-card-background;
    color: $color-white;
    font-family: $font-mono;
    font-size: 0.7rem;
    line-height: 1.4;
    word-break: break-all;
    resize: vertical;
  }
}

.ndfi_alts {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  &__row {
    font-family: $font-mono;
    font-size: 11px;
    color: $color-steel-blue;
    word-break: break-word;
  }
}

.ndfi_quote_age {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  font-family: $font-mono;
  font-size: 11px;
  color: $color-steel-blue;
}

/* Calldata is proof, not a control: folded away until someone wants to read
   it, rather than taking a third of every step card. */
.ndfi_details {
  summary {
    font-family: $font-mono;
    font-size: 11px;
    color: $color-steel-blue;
    cursor: pointer;
    list-style: none;

    &::-webkit-details-marker {
      display: none;
    }

    &::before {
      content: "▸ ";
    }
  }

  &[open] summary::before {
    content: "▾ ";
  }
}

.ndfi_hex {
  margin-top: 0.5rem;
  font-family: $font-mono;
  font-size: 10.5px;
  line-height: 1.6;
  color: $color-light-subtitle;
  word-break: break-all;
  max-height: 96px;
  overflow: auto;
  border: 1px solid $color-line;
  border-radius: $default-border-radius;
  padding: 0.5rem 0.625rem;
}

.ndfi_mono_dim {
  font-family: $font-mono;
  font-size: 11px;
  color: $color-steel-blue;
  word-break: break-all;
  text-decoration: none;
}

.ndfi_text_action.v-btn {
  color: $color-cyan !important;
  font-weight: 600;
}

.ndfi_ok {
  color: $color-cyan;
  font-family: $font-mono;
  font-size: 12px;
  text-decoration: none;

  &:hover {
    color: $color-cyan;
    text-decoration: underline;
  }
}
</style>
