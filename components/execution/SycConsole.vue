<template>
  <div class="syc">
    <!-- Not an executor: said once, at the top, since every button below is off for this wallet. -->
    <div v-if="membership === 'stranger'" class="syc_banner">
      <b>{{ shortAddress(accountStore.activeAccountAddress || "") }} is not an executor of this vault.</b>
    </div>

    <div class="syc_grid">
      <!-- ================================================================ Swap -->
      <div class="brand_card syc_card syc_swap">
        <div class="brand_card__head syc_head">
          <div class="brand_card__eyebrow">
            Swap
          </div>
          <div class="brand_card__meta">
            {{ totalUsdText }}
          </div>
        </div>

        <!-- Sell -->
        <div class="syc_box" :class="{ 'syc_box--focus': focused === 'sell' }">
          <div class="syc_box__label">
            Sell
          </div>
          <div class="syc_box__row">
            <input
              v-model="amountText"
              class="syc_amount"
              inputmode="decimal"
              placeholder="0"
              spellcheck="false"
              autocomplete="off"
              @focus="focused = 'sell'"
              @blur="focused = null"
            >
            <div class="syc_picker">
              <button class="syc_token" type="button" @click="togglePicker('sell')">
                <ExecutionTokenMark :symbol="sellToken.symbol" />
                <span>{{ sellToken.symbol }}</span>
                <Icon
                  icon="material-symbols:keyboard-arrow-down-rounded"
                  class="syc_token__chevron"
                  width="1.4rem"
                  height="1.4rem"
                />
              </button>
              <div v-if="picker === 'sell'" class="syc_menu">
                <button
                  v-for="t in SYC_TOKENS"
                  :key="t.symbol"
                  class="syc_menu__item"
                  :class="{ 'syc_menu__item--on': t.symbol === sellToken.symbol }"
                  type="button"
                  @click="pick('sell', t)"
                >
                  <ExecutionTokenMark :symbol="t.symbol" />
                  <span class="syc_menu__symbol">{{ t.symbol }}</span>
                  <span class="syc_menu__balance">{{ fmtBalance(t) }}</span>
                </button>
              </div>
            </div>
          </div>
          <div class="syc_box__meta">
            <span>{{ sellUsdText }}</span>
            <span class="syc_box__balance">
              Balance: {{ fmtBalance(sellToken) }}
              <button
                v-if="(holdingOf(sellToken)?.balance ?? 0n) > 0n"
                class="syc_chip"
                type="button"
                @click="setMax"
              >
                Max
              </button>
            </span>
          </div>
        </div>

        <div class="syc_flip_row">
          <button
            class="syc_flip"
            type="button"
            title="Swap direction"
            @click="flip"
          >
            <Icon icon="material-symbols:arrow-downward-rounded" width="1.1rem" height="1.1rem" />
          </button>
        </div>

        <!-- Buy -->
        <div class="syc_box syc_box--buy">
          <div class="syc_box__label">
            Buy
          </div>
          <div class="syc_box__row">
            <div
              class="syc_amount syc_amount--out"
              :class="{ 'syc_amount--muted': !quote, 'syc_amount--loading': quoting && !quote }"
            >
              {{ quote ? fmtUnits(quote.amountOut, buyToken.decimals, 6) : "0" }}
            </div>
            <div class="syc_picker">
              <button class="syc_token" type="button" @click="togglePicker('buy')">
                <ExecutionTokenMark :symbol="buyToken.symbol" />
                <span>{{ buyToken.symbol }}</span>
                <Icon
                  icon="material-symbols:keyboard-arrow-down-rounded"
                  class="syc_token__chevron"
                  width="1.4rem"
                  height="1.4rem"
                />
              </button>
              <div v-if="picker === 'buy'" class="syc_menu">
                <button
                  v-for="t in SYC_TOKENS"
                  :key="t.symbol"
                  class="syc_menu__item"
                  :class="{ 'syc_menu__item--on': t.symbol === buyToken.symbol }"
                  type="button"
                  @click="pick('buy', t)"
                >
                  <ExecutionTokenMark :symbol="t.symbol" />
                  <span class="syc_menu__symbol">{{ t.symbol }}</span>
                  <span class="syc_menu__balance">{{ fmtBalance(t) }}</span>
                </button>
              </div>
            </div>
          </div>
          <div class="syc_box__meta">
            <span>
              {{ buyUsdText }}
              <em
                v-if="quote && quote.impactPct"
                class="syc_impact"
                :class="{ 'syc_impact--bad': quote.impactPct < -Number(slippage) }"
              >({{ quote.impactPct > 0 ? "+" : "" }}{{ quote.impactPct.toFixed(2) }}%)</em>
            </span>
            <span class="syc_box__balance">Balance: {{ fmtBalance(buyToken) }}</span>
          </div>
        </div>

        <!-- Price, venue, route -->
        <details
          v-if="quote"
          class="syc_summary"
          :open="summaryOpen"
          @toggle="summaryOpen = ($event.target as HTMLDetailsElement).open"
        >
          <summary>
            <span class="syc_summary__rate">{{ rateText }}</span>
            <span class="syc_summary__age">{{ quoting ? "updating…" : quoteAgeText }}</span>
            <span class="syc_summary__chevron">▾</span>
          </summary>
          <div class="syc_summary__body">
            <div class="syc_kv">
              <span>Venue</span><span>{{ VENUE_LABELS[quote.venue] }}</span>
            </div>
            <div class="syc_kv">
              <span>Route</span><span>{{ routeLabel(quote.route) }}</span>
            </div>
            <div class="syc_kv">
              <span>Price from</span><span>{{ quote.source === "venue" ? "the router, simulated from the Safe" : "Uniswap QuoterV2" }}</span>
            </div>
            <div class="syc_kv">
              <span>Min. received</span><span>{{ fmtUnits(quote.minReturn, buyToken.decimals, 6) }} {{ buyToken.symbol }}</span>
            </div>
            <div class="syc_kv syc_kv--control">
              <span>Max slippage</span>
              <span>
                <input
                  v-model="slippage"
                  class="syc_small_input"
                  inputmode="decimal"
                  spellcheck="false"
                >%
              </span>
            </div>
            <div class="syc_kv">
              <span>Receiver</span><span>Safe {{ shortAddress(SYC.ADDR.safe) }}</span>
            </div>
            <div class="syc_kv">
              <span>Sent as</span>
              <span>{{ isConnectedAsSafe ? "the Safe, unwrapped" : `Roles ${shortAddress(SYC.ADDR.roles)} · ${SYC.ROLE}` }}</span>
            </div>
            <div v-if="quote.alternatives.length" class="syc_kv syc_kv--stack">
              <span>Other quotes</span>
              <span>
                <div v-for="alt in quote.alternatives" :key="alt">{{ alt }}</div>
              </span>
            </div>
            <button class="syc_link" type="button" @click="copyText(quote.call.data, 'Calldata copied.')">
              Copy calldata
            </button>
          </div>
        </details>

        <div v-if="swapNotice" class="syc_notice" :class="{ 'syc_notice--bad': swap.error }">
          {{ swapNotice }}
        </div>

        <v-tooltip activator="parent" location="bottom" :disabled="!cta.hint">
          <template #activator>
            <v-btn
              class="syc_cta"
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

        <div v-if="swap.done" class="syc_done">
          <Icon icon="octicon:check-circle-fill-16" width="1rem" height="1rem" />
          <span>{{ swap.done }}</span>
          <a
            v-if="swap.hash"
            :href="txUrl(swap.hash)"
            target="_blank"
            rel="noopener noreferrer"
          >view</a>
        </div>
        <div v-else-if="swap.hash && swap.phase === 'pending'" class="syc_pending">
          <a :href="txUrl(swap.hash)" target="_blank" rel="noopener noreferrer">
            {{ shortAddress(swap.hash) }} · waiting for the block
          </a>
        </div>
      </div>

      <!-- ============================================================ Positions -->
      <div class="brand_card syc_card syc_lp">
        <div class="brand_card__head syc_head">
          <div class="brand_card__eyebrow">
            Positions
          </div>
          <div class="syc_head__right">
            <div class="syc_fig syc_fig--inline">
              <span class="syc_fig__value">{{ state ? fmtPrice(state.sniPrice / (priceOf(USDC) || 1)) : "…" }} USDC</span>
              <span class="syc_fig__label">per SNI</span>
            </div>
            <v-btn
              variant="outlined"
              size="small"
              class="syc_refresh"
              :loading="loading"
              @click="refreshState"
            >
              Refresh
            </v-btn>
          </div>
        </div>

        <!-- The Safe's holdings, the stock every position and swap draws on. -->
        <div class="syc_holdings">
          <div v-for="t in SYC_TOKENS" :key="t.symbol" class="syc_fig">
            <div class="syc_fig__value">
              <ExecutionTokenMark :symbol="t.symbol" size="16px" />
              {{ fmtBalance(t) }} {{ t.symbol }}
            </div>
            <div class="syc_fig__label">
              {{ holdingOf(t) ? `$${fmtUsd(holdingOf(t)!.usd)}` : "in the Safe" }}
            </div>
          </div>
        </div>

        <!-- Open positions -->
        <div v-if="state && !state.positions.length" class="syc_empty">
          No positions
        </div>
        <div v-for="pos in state?.positions ?? []" :key="pos.tokenId.toString()" class="syc_pos">
          <div class="syc_pos__head">
            <span class="syc_pos__id">#{{ pos.tokenId.toString() }}</span>
            <span class="syc_pos__pair">{{ positionPair(pos) }}</span>
            <span class="syc_tag" :class="pos.inRange ? 'syc_tag--on' : 'syc_tag--off'">
              {{ pos.liquidity === 0n ? "Empty" : pos.inRange ? "In range" : "Out of range" }}
            </span>
            <a
              :href="positionUrl(pos)"
              target="_blank"
              rel="noopener noreferrer"
              class="syc_pos__link"
            >Uniswap</a>
          </div>
          <div class="syc_pos__figs">
            <div class="syc_fig">
              <div class="syc_fig__value">
                {{ fmtUnits(pos.amount0, 6, 2) }} USDC
              </div>
              <div class="syc_fig__label">
                Liquidity
              </div>
            </div>
            <div class="syc_fig">
              <div class="syc_fig__value">
                {{ fmtUnits(pos.amount1, 18, 2) }} SNI
              </div>
              <div class="syc_fig__label">
                Liquidity
              </div>
            </div>
            <div class="syc_fig">
              <div class="syc_fig__value">
                {{ fmtUnits(pos.collectable0, 6, 4) }} USDC
              </div>
              <div class="syc_fig__label">
                Collectable
              </div>
            </div>
            <div class="syc_fig">
              <div class="syc_fig__value">
                {{ fmtUnits(pos.collectable1, 18, 4) }} SNI
              </div>
              <div class="syc_fig__label">
                Collectable
              </div>
            </div>
            <div class="syc_fig syc_fig--wide">
              <div class="syc_fig__value">
                {{ rangeText(pos) }}
              </div>
              <div class="syc_fig__label">
                Range, USDC per SNI
              </div>
            </div>
          </div>
          <div class="syc_pos__actions">
            <v-btn
              v-if="pos.collectable0 > 0n || pos.collectable1 > 0n"
              variant="outlined"
              size="small"
              :disabled="!canAct"
              @click="collectFees(pos)"
            >
              Collect
            </v-btn>
            <v-btn
              v-if="pos.liquidity > 0n"
              variant="outlined"
              size="small"
              :disabled="!canAct"
              @click="removing = removing === pos.tokenId ? null : pos.tokenId"
            >
              Remove
            </v-btn>
            <v-btn
              v-if="pos.liquidity === 0n && pos.collectable0 === 0n && pos.collectable1 === 0n"
              variant="outlined"
              size="small"
              :disabled="!canAct"
              @click="burnPosition(pos)"
            >
              Burn
            </v-btn>
          </div>
          <div v-if="removing === pos.tokenId" class="syc_panel">
            <div class="syc_panel__row">
              <div class="syc_chips">
                <button
                  v-for="p in [25, 50, 75, 100]"
                  :key="p"
                  class="syc_chip"
                  :class="{ 'syc_chip--on': removePct === p }"
                  type="button"
                  @click="removePct = p"
                >
                  {{ p }}%
                </button>
              </div>
              <span class="syc_kv syc_kv--control">
                <span>Max slippage</span>
                <span><input
                  v-model="lpSlippage"
                  class="syc_small_input"
                  inputmode="decimal"
                  spellcheck="false"
                >%</span>
              </span>
            </div>
            <div class="syc_panel__row syc_panel__figs">
              <div class="syc_fig">
                <div class="syc_fig__value">
                  {{ fmtUnits(removePreview(pos).amount0, 6, 2) }} USDC
                </div>
                <div class="syc_fig__label">
                  Expected
                </div>
              </div>
              <div class="syc_fig">
                <div class="syc_fig__value">
                  {{ fmtUnits(removePreview(pos).amount1, 18, 2) }} SNI
                </div>
                <div class="syc_fig__label">
                  Expected
                </div>
              </div>
            </div>
            <v-btn
              class="bg-primary text-secondary"
              variant="flat"
              size="small"
              :disabled="!canAct || !lpSlippagePct"
              @click="removeLiquidity(pos)"
            >
              {{ removePct === 100 ? "Remove all and burn" : `Remove ${removePct}%` }}
            </v-btn>
          </div>
        </div>

        <!-- New position -->
        <div class="syc_new">
          <div class="syc_new__title">
            New position
            <span class="syc_new__pool">USDC/SNI 0.3%</span>
          </div>
          <div class="syc_new__grid">
            <label class="syc_field">
              <span class="syc_field__label">Min price</span>
              <input
                v-model="minPriceText"
                class="syc_field__input"
                inputmode="decimal"
                placeholder="0"
                spellcheck="false"
                @input="rangeTouched = true"
              >
              <span class="syc_field__unit">USDC per SNI</span>
            </label>
            <label class="syc_field">
              <span class="syc_field__label">Max price</span>
              <input
                v-model="maxPriceText"
                class="syc_field__input"
                inputmode="decimal"
                placeholder="∞"
                spellcheck="false"
                @input="rangeTouched = true"
              >
              <span class="syc_field__unit">USDC per SNI</span>
            </label>
          </div>
          <div class="syc_chips">
            <button
              class="syc_chip"
              :class="{ 'syc_chip--on': rangePreset === 'full' }"
              type="button"
              @click="setRangePreset('full')"
            >
              Full range
            </button>
            <button
              class="syc_chip"
              :class="{ 'syc_chip--on': rangePreset === 'wide' }"
              type="button"
              @click="setRangePreset('wide')"
            >
              ±50%
            </button>
            <button
              class="syc_chip"
              :class="{ 'syc_chip--on': rangePreset === 'tight' }"
              type="button"
              @click="setRangePreset('tight')"
            >
              ±10%
            </button>
            <span v-if="range" class="syc_chips__note">ticks {{ range.tickLower }} to {{ range.tickUpper }}</span>
          </div>
          <div class="syc_new__grid">
            <label class="syc_field">
              <span class="syc_field__label">USDC</span>
              <input
                v-model="usdcText"
                class="syc_field__input"
                inputmode="decimal"
                placeholder="0"
                spellcheck="false"
                :disabled="side === 'sni'"
                @input="lastEdited = 'usdc'"
              >
              <span class="syc_field__unit">
                <button
                  class="syc_chip"
                  type="button"
                  :disabled="side === 'sni'"
                  @click="setLpMax('usdc')"
                >Max</button>
              </span>
            </label>
            <label class="syc_field">
              <span class="syc_field__label">SNI</span>
              <input
                v-model="sniText"
                class="syc_field__input"
                inputmode="decimal"
                placeholder="0"
                spellcheck="false"
                :disabled="side === 'usdc'"
                @input="lastEdited = 'sni'"
              >
              <span class="syc_field__unit">
                <button
                  class="syc_chip"
                  type="button"
                  :disabled="side === 'usdc'"
                  @click="setLpMax('sni')"
                >Max</button>
              </span>
            </label>
          </div>
          <div class="syc_new__foot">
            <span class="syc_kv syc_kv--control">
              <span>Max slippage</span>
              <span><input
                v-model="lpSlippage"
                class="syc_small_input"
                inputmode="decimal"
                spellcheck="false"
              >%</span>
            </span>
            <span v-if="mintProblem" class="syc_new__problem">{{ mintProblem }}</span>
          </div>
          <v-tooltip activator="parent" location="bottom" :disabled="!lpCta.hint">
            <template #activator>
              <v-btn
                class="syc_cta"
                :class="lpCta.disabled ? '' : 'bg-primary text-secondary'"
                variant="flat"
                size="large"
                block
                :loading="lpCta.loading"
                :disabled="lpCta.disabled"
                @click="lpCta.action?.()"
              >
                {{ lpCta.text }}
              </v-btn>
            </template>
            <template #default>
              {{ lpCta.hint }}
            </template>
          </v-tooltip>
        </div>

        <div v-if="lp.error" class="syc_notice syc_notice--bad">
          {{ lp.error }}
        </div>
        <div v-if="lp.done" class="syc_done">
          <Icon icon="octicon:check-circle-fill-16" width="1rem" height="1rem" />
          <span>{{ lp.done }}</span>
          <a
            v-if="lp.hash"
            :href="txUrl(lp.hash)"
            target="_blank"
            rel="noopener noreferrer"
          >view</a>
        </div>
        <div v-else-if="lp.phase !== 'idle'" class="syc_pending">
          <span>{{ lpStatusText }}</span>
          <a
            v-if="lp.hash"
            :href="txUrl(lp.hash)"
            target="_blank"
            rel="noopener noreferrer"
          >{{ shortAddress(lp.hash) }}</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import {
  SYC,
  SYC_LP_POOL,
  SYC_TOKENS,
  VENUE_LABELS,
  amountsForLiquidity,
  buildApprove,
  buildBurn,
  buildCollect,
  buildDecreaseLiquidity,
  buildMint,
  buildSwap,
  deadlineIn,
  fmtPrice,
  fmtUnits,
  fmtUsd,
  fullRange,
  lessPct,
  minReturnFor,
  pairedAmount,
  parseAmount,
  parsePct,
  quoteBothVenues,
  rangeFromPrices,
  routeLabel,
  sqrtRatioAtTick,
  sycExplainDenial,
  sycReadState,
  sycRouteBetween,
  sycSafeBalance,
  sycToken,
  sycValidate,
  tickToPrice,
  venueSpender,
  type SycCall,
  type SycPosition,
  type SycQuote,
  type SycState,
  type SycToken,
  type SycVenue,
} from "~/composables/execution/sycConsole";
import type { UnoswapRoute } from "~/composables/execution/onchainSwap";
import { shortAddress, swapImpactPct } from "~/composables/execution/oneInchSwap";
import {
  sendCuratorTransaction,
  simulateCuratorTransaction,
  useCuratorExecution,
  type ICuratorRoute,
} from "~/composables/permissions/useCuratorExecution";
import { RolesVersion, simulateDirectCall } from "~/composables/permissions/useRoleExecution";
import { useAccountStore } from "~/store/account/account.store";
import { useToastStore } from "~/store/toasts/toast.store";

const toastStore = useToastStore();
const accountStore = useAccountStore();

/**
 * Every call here acts with the Safe's authority: the executor's wallet
 * signs and the vault's Roles v2 modifier forwards it, or a session connected
 * as the Safe sends it unwrapped. The route is a fact of this vault, so it is
 * handed to the shared layer rather than resolved from the wallet's
 * membership, which also lets the console work before the vault is finalized.
 */
const { isConnectedAsSafe } = useCuratorExecution();
const SYC_ROUTE: ICuratorRoute = {
  chainId: SYC.CHAIN,
  rolesModAddress: SYC.ADDR.roles,
  role: SYC.ROLE,
  version: RolesVersion.V2,
};

const USDC = sycToken("USDC");
const SNI = sycToken("SNI");
const QUOTE_TTL_MS = 30_000;
const QUOTE_DEBOUNCE_MS = 450;

const txUrl = (hash: string) => `${SYC.EXPLORER}/tx/${hash}`;

/* -------------------------------------------------------------------------- */
/* Membership                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Whether the connected wallet is an executor, asked the way Roles v2
 * answers it: dry-run something harmless the role allows. A wallet the
 * modifier has never heard of is refused before any condition is looked at.
 */
const membership = ref<"unknown" | "member" | "stranger">("unknown");
watch(
  () => accountStore.activeAccountAddress,
  async (account) => {
    membership.value = "unknown";
    if (!account) return;
    const probe = await simulateCuratorTransaction(buildCollect(0n), SYC_ROUTE).catch(() => null);
    if (account !== accountStore.activeAccountAddress || !probe) return;
    if (probe.ok || probe.innerRevert) membership.value = "member";
    else if (/not an executor/.test(sycExplainDenial(probe.reason))) membership.value = "stranger";
  },
  { immediate: true },
);

/* -------------------------------------------------------------------------- */
/* State                                                                       */
/* -------------------------------------------------------------------------- */

const state = ref<SycState | null>(null);
const loading = ref(false);

const holdingOf = (token: SycToken) => state.value?.holdings.find((h) => h.token.symbol === token.symbol);
const priceOf = (token: SycToken) => holdingOf(token)?.price ?? 0;
const allowanceOf = (token: SycToken, spender: string) =>
  holdingOf(token)?.allowance[spender.toLowerCase()] ?? 0n;
const fmtBalance = (token: SycToken) => {
  const held = holdingOf(token)?.balance;
  if (held === undefined) return "…";
  return fmtUnits(held, token.decimals, token.decimals === 6 ? 2 : 4);
};
const totalUsdText = computed(() => (state.value ? `$${fmtUsd(state.value.totalUsd)} in the Safe` : ""));

const refreshState = async () => {
  loading.value = true;
  try {
    state.value = await sycReadState();
  } catch (error: any) {
    console.error(error);
    toastStore.errorToast(error?.message || "Could not read the Safe's holdings.");
  } finally {
    loading.value = false;
  }
};

const lpPool = computed(() => state.value?.pools.find((p) => p.pool.address === SYC_LP_POOL.address));

/* -------------------------------------------------------------------------- */
/* One action: validate, dry-run, sign, wait                                   */
/* -------------------------------------------------------------------------- */

type Phase = "idle" | "quoting" | "simulating" | "signing" | "pending";
interface Activity {
  phase: Phase;
  step: number;
  steps: number;
  label: string;
  hash: string;
  error: string;
  done: string;
}
const blank = (): Activity => ({ phase: "idle", step: 0, steps: 0, label: "", hash: "", error: "", done: "" });
const swap = reactive<Activity>(blank());
const lp = reactive<Activity>(blank());

const busy = computed(() => swap.phase !== "idle" || lp.phase !== "idle");
const canAct = computed(() => accountStore.isConnected && membership.value !== "stranger" && !busy.value);

const declined = (err: any) => {
  const message = err?.innerError?.message || err?.message || "";
  return err?.code === 4001 || err?.innerError?.code === 4001 || /user (denied|rejected)/i.test(message);
};

const ensureChain = async () => {
  if (!accountStore.connectedWalletWeb3) throw new Error("Connect your wallet.");
  // Every address on this screen is a Polygon one.
  if (accountStore.connectedWalletChainId !== SYC.CHAIN) {
    await accountStore.switchNetwork(SYC.CHAIN);
  }
};

/**
 * One call, start to finish. The console's own rules first (a call the
 * grants refuse is never dry-run), then the modifier's dry-run from the
 * connected wallet (a denial is explained and stops here), then the wallet.
 * Resolves true once the transaction is mined with status 1.
 */
const runCall = async (activity: Activity, call: SycCall, label: string): Promise<boolean> => {
  activity.label = label;
  const problems = sycValidate(call);
  if (problems.length) throw new Error(problems.join(" "));

  activity.phase = "simulating";
  const simulation = await simulateCuratorTransaction(call, SYC_ROUTE);
  if (!simulation.ok) {
    if (simulation.innerRevert) {
      const direct = await simulateDirectCall(SYC.CHAIN, SYC.ADDR.safe, call).catch(() => null);
      const reason = direct && !direct.ok ? direct.reason : simulation.reason;
      throw new Error(`The role allows this, but the call itself would fail right now${reason ? ": " + reason : "."}`);
    }
    throw new Error(sycExplainDenial(simulation.reason));
  }

  activity.phase = "signing";
  activity.hash = "";
  return await new Promise<boolean>((resolve, reject) => {
    // Not awaited: the emitter comes back synchronously, and awaiting a
    // PromiEvent yields the receipt, with no .on() left to register on.
    sendCuratorTransaction(call, SYC_ROUTE)
      .on("transactionHash", (hash: any) => {
        activity.hash = String(hash);
        activity.phase = "pending";
      })
      .on("receipt", (receipt: any) => {
        if (!receipt.status) reject(new Error("The transaction reverted on chain."));
        else resolve(true);
      })
      .catch((err: any) => (declined(err) ? resolve(false) : reject(err)));
  });
};

/** A sequence of calls behind one press, counted for the status line. */
const runSteps = async (
  activity: Activity,
  steps: { call: SycCall; label: string }[],
  doneText: string,
): Promise<boolean> => {
  if (busy.value) return false;
  Object.assign(activity, blank());
  activity.steps = steps.length;
  try {
    await ensureChain();
    for (let i = 0; i < steps.length; i++) {
      activity.step = i + 1;
      const ok = await runCall(activity, steps[i].call, steps[i].label);
      if (!ok) return false;
    }
    activity.done = doneText;
    await refreshState();
    return true;
  } catch (err: any) {
    console.error(err);
    activity.error = err?.message || "There has been an error.";
    return false;
  } finally {
    activity.phase = "idle";
  }
};

const copyText = (text: string, message: string) => {
  navigator.clipboard
    ?.writeText(text)
    .then(() => toastStore.successToast(message))
    .catch(() => toastStore.errorToast("Could not copy to the clipboard."));
};

/* -------------------------------------------------------------------------- */
/* Swap: the pair                                                              */
/* -------------------------------------------------------------------------- */

const sellSymbol = ref("WETH");
const buySymbol = ref("SNI");
const amountText = ref("");
const slippage = ref("1");
const focused = ref<"sell" | null>(null);
const picker = ref<"sell" | "buy" | null>(null);
const summaryOpen = ref(false);

const sellToken = computed(() => sycToken(sellSymbol.value));
const buyToken = computed(() => sycToken(buySymbol.value));

const togglePicker = (side: "sell" | "buy") => {
  picker.value = picker.value === side ? null : side;
};

/** Choosing the other side's token swaps the pair, the way Uniswap does. */
const pick = (side: "sell" | "buy", token: SycToken) => {
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
  const held = holdingOf(sellToken.value)?.balance ?? 0n;
  const typed = parseAmount(amountText.value, sellToken.value.decimals);
  if (typed && typed > held) amountText.value = "";
};

const closePickers = (event: MouseEvent) => {
  if (!(event.target as HTMLElement)?.closest?.(".syc_picker")) picker.value = null;
};
onMounted(() => document.addEventListener("click", closePickers));
onBeforeUnmount(() => document.removeEventListener("click", closePickers));

const amount = computed(() => parseAmount(amountText.value, sellToken.value.decimals));
const slippagePct = computed(() => parsePct(slippage.value));
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
/* Swap: quoting                                                               */
/* -------------------------------------------------------------------------- */

interface Quote {
  amountIn: bigint;
  amountOut: bigint;
  minReturn: bigint;
  venue: SycVenue;
  route: UnoswapRoute;
  source: SycQuote["source"];
  alternatives: string[];
  /** Against the marks the console prices with; negative means value given up. */
  impactPct: number;
  /** The router call, already checked against the grants. */
  call: SycCall;
  at: number;
}

const quote = ref<Quote | null>(null);
const quoting = ref(false);
const quoteError = ref("");
let quoteSeq = 0;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

const venueAllowances = (token: SycToken): Record<SycVenue, bigint> => ({
  oneInch: allowanceOf(token, venueSpender("oneInch")),
  uniswap: allowanceOf(token, venueSpender("uniswap")),
});

/**
 * The route the grants allow for the pair, priced on both venues, the best
 * built as its router call and held against the grants before it is shown.
 */
const fetchQuote = async (sell: SycToken, buy: SycToken, amountIn: bigint, tolerance: number): Promise<Quote> => {
  const route = sycRouteBetween(sell, buy);
  if (!route) throw new Error(`No listed pool trades ${sell.symbol} for ${buy.symbol}.`);
  const quotes = await quoteBothVenues(route, amountIn, venueAllowances(sell));
  if (!quotes.length) {
    throw new Error(`The pools cannot fill ${fmtUnits(amountIn, sell.decimals, 6)} ${sell.symbol}. Try a smaller amount.`);
  }
  const best = quotes[0];
  const minReturn = minReturnFor(best.amountOut, tolerance);
  const call = buildSwap(best.venue, { route, amountIn, minReturn });
  const problems = sycValidate(call);
  if (problems.length) throw new Error(problems.join(" "));
  return {
    amountIn,
    amountOut: best.amountOut,
    minReturn,
    venue: best.venue,
    route,
    source: best.source,
    alternatives: quotes
      .slice(1)
      .map((q) => `${VENUE_LABELS[q.venue]}: ${fmtUnits(q.amountOut, buy.decimals, 6)} ${buy.symbol}${q.needsApproval ? ", needs an approval" : ""}`),
    impactPct: swapImpactPct(amountIn, sell, priceOf(sell), best.amountOut, buy, priceOf(buy)),
    call,
    at: Date.now(),
  };
};

/** Re-price what is on screen. Answers to an older question are dropped. */
const refreshQuote = async () => {
  const seq = ++quoteSeq;
  quoteError.value = "";
  if (!amount.value || insufficient.value || !slippagePct.value) {
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
watch([amount, sellSymbol, buySymbol, slippagePct], scheduleQuote);

const now = ref(Date.now());
const clock = setInterval(() => {
  now.value = Date.now();
  if (quote.value && !quoting.value && swap.phase === "idle" && now.value - quote.value.at > QUOTE_TTL_MS) {
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
/* Swap: executing                                                             */
/* -------------------------------------------------------------------------- */

const swapNeedsApproval = computed(
  () => !!quote.value && !!amount.value && allowanceOf(sellToken.value, venueSpender(quote.value.venue)) < amount.value,
);

const swapNotice = computed(() => swap.error || quoteError.value || "");

/** The one button, saying what it will do or why it cannot. */
const cta = computed<{ text: string; disabled: boolean; loading?: boolean; hint?: string; action?: () => void }>(() => {
  if (!accountStore.isConnected) return { text: "Connect wallet", disabled: false, action: () => accountStore.connectWallet() };
  if (membership.value === "stranger") return { text: "Not an executor of this vault", disabled: true };
  if (!amount.value) return { text: "Enter an amount", disabled: true };
  if (insufficient.value) return { text: `Insufficient ${sellToken.value.symbol} balance`, disabled: true };
  if (!slippagePct.value) return { text: "Set a slippage between 0 and 50%", disabled: true };
  if (swap.phase === "quoting") return { text: "Refreshing price…", disabled: true, loading: true };
  if (swap.phase === "simulating") return { text: swap.label === "approve" ? "Checking the approval…" : "Checking permissions…", disabled: true, loading: true };
  if (swap.phase === "signing") return { text: "Confirm in your wallet", disabled: true, loading: true };
  if (swap.phase === "pending") return { text: swap.label === "approve" ? `Approving ${sellToken.value.symbol}…` : "Swapping…", disabled: true, loading: true };
  if (lp.phase !== "idle") return { text: "Swap", disabled: true, hint: "A position transaction is in progress." };
  if (quoting.value && !quote.value) return { text: "Finding the best price…", disabled: true, loading: true };
  if (!quote.value) return { text: "No route", disabled: true, hint: quoteError.value };
  if (swapNeedsApproval.value) {
    return { text: `Approve ${sellToken.value.symbol} for ${VENUE_LABELS[quote.value.venue]}`, disabled: false, action: approveForSwap };
  }
  return { text: "Swap", disabled: false, action: doSwap };
});

const approveForSwap = async () => {
  if (!quote.value) return;
  const sell = sellToken.value;
  const spender = venueSpender(quote.value.venue);
  const ok = await runSteps(swap, [{ call: buildApprove(sell, spender), label: "approve" }], `${sell.symbol} approved for ${VENUE_LABELS[quote.value.venue]}`);
  // The venue can now be simulated from the Safe: re-price from its own arithmetic.
  if (ok) refreshQuote();
};

/** Re-price if stale, re-check the balance, dry-run, sign, wait. */
const doSwap = async () => {
  if (busy.value || !quote.value) return;
  const sell = sellToken.value;
  const buy = buyToken.value;
  Object.assign(swap, blank());
  try {
    await ensureChain();
    let current = quote.value;
    if (Date.now() - current.at > QUOTE_TTL_MS) {
      swap.phase = "quoting";
      current = await fetchQuote(sell, buy, current.amountIn, slippagePct.value ?? 1);
      quote.value = current;
    }
    const held = await sycSafeBalance(sell);
    if (held < current.amountIn) {
      throw new Error(`The Safe holds ${fmtUnits(held, sell.decimals, 6)} ${sell.symbol}, less than this swap sells.`);
    }
    swap.steps = 1;
    swap.step = 1;
    const ok = await runCall(swap, current.call, "swap");
    if (ok) {
      swap.done = `Swapped ${fmtUnits(current.amountIn, sell.decimals, 6)} ${sell.symbol} for at least ${fmtUnits(current.minReturn, buy.decimals, 6)} ${buy.symbol}`;
      amountText.value = "";
      quote.value = null;
      await refreshState();
    }
  } catch (err: any) {
    console.error(err);
    swap.error = err?.message || "There has been an error.";
  } finally {
    swap.phase = "idle";
  }
};

/* -------------------------------------------------------------------------- */
/* Positions: reading                                                          */
/* -------------------------------------------------------------------------- */

const positionPair = (pos: SycPosition) => {
  const t0 = SYC_TOKENS.find((t) => t.address.toLowerCase() === pos.token0.toLowerCase())?.symbol ?? shortAddress(pos.token0);
  const t1 = SYC_TOKENS.find((t) => t.address.toLowerCase() === pos.token1.toLowerCase())?.symbol ?? shortAddress(pos.token1);
  return `${t0}/${t1} ${(pos.fee / 10000).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
};
const positionUrl = (pos: SycPosition) => `https://app.uniswap.org/positions/v3/polygon/${pos.tokenId.toString()}`;
const rangeText = (pos: SycPosition) => {
  const lo = tickToPrice(pos.tickUpper);
  const hi = tickToPrice(pos.tickLower);
  const full = pos.tickLower <= fullRange().tickLower && pos.tickUpper >= fullRange().tickUpper;
  return full ? "Full range" : `${fmtPrice(lo)} to ${fmtPrice(hi)}`;
};

/* -------------------------------------------------------------------------- */
/* Positions: collect, remove, burn                                            */
/* -------------------------------------------------------------------------- */

const removing = ref<bigint | null>(null);
const removePct = ref(100);
const lpSlippage = ref("1");
const lpSlippagePct = computed(() => parsePct(lpSlippage.value));

const collectFees = (pos: SycPosition) =>
  runSteps(lp, [{ call: buildCollect(pos.tokenId), label: "collect" }], `Collected from #${pos.tokenId} into the Safe`);

const burnPosition = (pos: SycPosition) =>
  runSteps(lp, [{ call: buildBurn(pos.tokenId), label: "burn" }], `Position #${pos.tokenId} burned`);

const removePreview = (pos: SycPosition): { liquidity: bigint; amount0: bigint; amount1: bigint } => {
  const liquidity = (pos.liquidity * BigInt(removePct.value)) / 100n;
  const pool = lpPool.value;
  if (!pool || pool.sqrtPriceX96 === 0n) return { liquidity, amount0: 0n, amount1: 0n };
  const amounts = amountsForLiquidity(pool.sqrtPriceX96, sqrtRatioAtTick(pos.tickLower), sqrtRatioAtTick(pos.tickUpper), liquidity);
  return { liquidity, ...amounts };
};

/**
 * Remove part of a position: the liquidity comes out, the tokens wait in
 * the position, a collect brings them (and any fees) to the Safe. Removing
 * everything also burns the emptied NFT.
 */
const removeLiquidity = (pos: SycPosition) => {
  const tolerance = lpSlippagePct.value;
  if (!tolerance) return;
  const { liquidity, amount0, amount1 } = removePreview(pos);
  if (liquidity === 0n) return;
  const steps = [
    {
      call: buildDecreaseLiquidity({
        tokenId: pos.tokenId,
        liquidity,
        amount0Min: lessPct(amount0, tolerance),
        amount1Min: lessPct(amount1, tolerance),
        deadline: deadlineIn(),
      }),
      label: "remove",
    },
    { call: buildCollect(pos.tokenId), label: "collect" },
  ];
  if (removePct.value === 100) steps.push({ call: buildBurn(pos.tokenId), label: "burn" });
  removing.value = null;
  return runSteps(
    lp,
    steps,
    removePct.value === 100 ? `Position #${pos.tokenId} closed, tokens in the Safe` : `Removed ${removePct.value}% of #${pos.tokenId} into the Safe`,
  );
};

/* -------------------------------------------------------------------------- */
/* Positions: minting                                                          */
/* -------------------------------------------------------------------------- */

const minPriceText = ref("");
const maxPriceText = ref("");
const rangeTouched = ref(false);
const rangePreset = ref<"full" | "wide" | "tight" | null>(null);
const usdcText = ref("");
const sniText = ref("");
const lastEdited = ref<"usdc" | "sni">("usdc");

const currentPrice = computed(() => (lpPool.value ? tickToPrice(lpPool.value.tick) : 0));

const setRangePreset = (preset: "full" | "wide" | "tight") => {
  rangePreset.value = preset;
  rangeTouched.value = true;
  if (preset === "full") {
    minPriceText.value = "0";
    maxPriceText.value = "";
    return;
  }
  const p = currentPrice.value;
  if (!p) return;
  const width = preset === "wide" ? 0.5 : 0.1;
  minPriceText.value = fmtPrice(p * (1 - width)).replace(/,/g, "");
  maxPriceText.value = fmtPrice(p * (1 + width)).replace(/,/g, "");
};

/** The typed range as ticks; "0" and empty mean the pool's ends. */
const range = computed<{ tickLower: number; tickUpper: number } | null>(() => {
  const minText = minPriceText.value.trim().replace(",", ".");
  const maxText = maxPriceText.value.trim().replace(",", ".");
  if (!minText && !maxText) return null;
  const min = Number(minText || "0");
  const max = maxText ? Number(maxText) : Infinity;
  if (!Number.isFinite(min) || min < 0 || Number.isNaN(max) || max <= min) return null;
  const full = fullRange();
  try {
    if (min === 0 && max === Infinity) return full;
    if (min === 0) return { tickLower: rangeFromPrices(1e-30, max).tickLower, tickUpper: full.tickUpper };
    if (max === Infinity) return { tickLower: full.tickLower, tickUpper: rangeFromPrices(min, 1e30).tickUpper };
    return rangeFromPrices(min, max);
  } catch {
    return null;
  }
});

watch([minPriceText, maxPriceText], () => {
  // A hand-typed range is no preset any more.
  const p = currentPrice.value;
  if (!p || !rangePreset.value) return;
  const want = rangePreset.value === "full" ? ["0", ""] : null;
  if (want && (minPriceText.value !== want[0] || maxPriceText.value !== want[1])) rangePreset.value = null;
});

/** Which side a one-sided range takes; null when the price is inside it. */
const side = computed<"usdc" | "sni" | null>(() => {
  const pool = lpPool.value;
  const r = range.value;
  if (!pool || !r || pool.sqrtPriceX96 === 0n) return null;
  if (pool.sqrtPriceX96 <= sqrtRatioAtTick(r.tickLower)) return "usdc";
  if (pool.sqrtPriceX96 >= sqrtRatioAtTick(r.tickUpper)) return "sni";
  return null;
});

const usdcAmount = computed(() => parseAmount(usdcText.value, 6));
const sniAmount = computed(() => parseAmount(sniText.value, 18));

/** A derived amount as text: enough digits to be exact for the pool, none of the dust. */
const trimmedAmount = (value: bigint, decimals: number, keep: number) => {
  const unit = 10n ** BigInt(Math.max(0, decimals - keep));
  return ethers.formatUnits((value / unit) * unit, decimals).replace(/\.?0+$/, "");
};

/** Typing one side fills the other with what the range calls for at the current price. */
const pairOther = () => {
  const pool = lpPool.value;
  const r = range.value;
  if (!pool || !r || side.value) return;
  if (lastEdited.value === "usdc") {
    const paired = usdcAmount.value ? pairedAmount(pool.sqrtPriceX96, r.tickLower, r.tickUpper, { amount0: usdcAmount.value }) : null;
    sniText.value = paired === null ? "" : trimmedAmount(paired, 18, 6);
  } else {
    const paired = sniAmount.value ? pairedAmount(pool.sqrtPriceX96, r.tickLower, r.tickUpper, { amount1: sniAmount.value }) : null;
    usdcText.value = paired === null ? "" : trimmedAmount(paired, 6, 6);
  }
};
watch([usdcText, sniText, range], ([u, s], [pu, ps]) => {
  if (u !== pu && lastEdited.value !== "usdc") return;
  if (s !== ps && lastEdited.value !== "sni") return;
  pairOther();
});
watch(side, (s) => {
  if (s === "usdc") sniText.value = "";
  if (s === "sni") usdcText.value = "";
});

const setLpMax = (which: "usdc" | "sni") => {
  lastEdited.value = which;
  const token = which === "usdc" ? USDC : SNI;
  const held = holdingOf(token)?.balance ?? 0n;
  const text = held > 0n ? ethers.formatUnits(held, token.decimals) : "";
  if (which === "usdc") usdcText.value = text;
  else sniText.value = text;
};

const mintProblem = computed(() => {
  if (!rangeTouched.value && !usdcText.value && !sniText.value) return "";
  if (!range.value) return rangeTouched.value ? "Enter a min price below the max price." : "";
  if (range.value.tickLower >= range.value.tickUpper) return "The range is too narrow for the pool's tick spacing.";
  const u = usdcAmount.value ?? 0n;
  const s = sniAmount.value ?? 0n;
  if (side.value === "usdc" && s > 0n) return "Above the max price the position takes USDC only.";
  if (side.value === "sni" && u > 0n) return "Below the min price the position takes SNI only.";
  if (u > (holdingOf(USDC)?.balance ?? 0n)) return "Not enough USDC in the Safe.";
  if (s > (holdingOf(SNI)?.balance ?? 0n)) return "Not enough SNI in the Safe.";
  return "";
});

const mintReady = computed(
  () =>
    !!range.value &&
    !mintProblem.value &&
    ((usdcAmount.value ?? 0n) > 0n || (sniAmount.value ?? 0n) > 0n) &&
    !!lpSlippagePct.value,
);

const mintApprovals = computed(() => {
  const list: SycToken[] = [];
  if ((usdcAmount.value ?? 0n) > allowanceOf(USDC, SYC.ADDR.npm)) list.push(USDC);
  if ((sniAmount.value ?? 0n) > allowanceOf(SNI, SYC.ADDR.npm)) list.push(SNI);
  return list;
});

const lpStatusText = computed(() => {
  const step = lp.steps > 1 ? `Step ${lp.step} of ${lp.steps} · ` : "";
  const what: Record<string, string> = {
    approve: "approving",
    mint: "opening the position",
    remove: "removing liquidity",
    collect: "collecting",
    burn: "burning",
  };
  const verb = what[lp.label] ?? lp.label;
  if (lp.phase === "simulating") return `${step}${verb}: checking permissions`;
  if (lp.phase === "signing") return `${step}${verb}: confirm in your wallet`;
  if (lp.phase === "pending") return `${step}${verb}: waiting for the block`;
  return "";
});

const lpCta = computed<{ text: string; disabled: boolean; loading?: boolean; hint?: string; action?: () => void }>(() => {
  if (!accountStore.isConnected) return { text: "Connect wallet", disabled: false, action: () => accountStore.connectWallet() };
  if (membership.value === "stranger") return { text: "Not an executor of this vault", disabled: true };
  if (lp.phase !== "idle") return { text: lpStatusText.value || "Working…", disabled: true, loading: true };
  if (swap.phase !== "idle") return { text: "Open position", disabled: true, hint: "A swap is in progress." };
  if (!range.value) return { text: "Set a price range", disabled: true };
  if (!(usdcAmount.value ?? 0n) && !(sniAmount.value ?? 0n)) return { text: "Enter an amount", disabled: true };
  if (mintProblem.value) return { text: "Open position", disabled: true, hint: mintProblem.value };
  if (!lpSlippagePct.value) return { text: "Set a slippage between 0 and 50%", disabled: true };
  const approvals = mintApprovals.value;
  const steps = approvals.length + 1;
  return {
    text: approvals.length ? `Approve ${approvals.map((t) => t.symbol).join(" and ")} and open position (${steps} transactions)` : "Open position",
    disabled: !mintReady.value,
    action: mint,
  };
});

const mint = () => {
  const r = range.value;
  const tolerance = lpSlippagePct.value;
  if (!r || !tolerance) return;
  const amount0 = usdcAmount.value ?? 0n;
  const amount1 = sniAmount.value ?? 0n;
  const steps = mintApprovals.value.map((token) => ({ call: buildApprove(token, SYC.ADDR.npm), label: "approve" }));
  steps.push({
    call: buildMint({
      tickLower: r.tickLower,
      tickUpper: r.tickUpper,
      amount0Desired: amount0,
      amount1Desired: amount1,
      amount0Min: lessPct(amount0, tolerance),
      amount1Min: lessPct(amount1, tolerance),
      deadline: deadlineIn(),
    }),
    label: "mint",
  });
  return runSteps(lp, steps, "Position opened in USDC/SNI 0.3%").then((ok) => {
    if (ok) {
      usdcText.value = "";
      sniText.value = "";
    }
  });
};

onMounted(refreshState);
</script>

<style scoped lang="scss">
.syc {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  margin-bottom: 2.5rem;
}

.syc_banner {
  padding: 0.875rem 1.125rem;
  border: 1px solid $color-neg-line;
  border-radius: $default-border-radius;
  background: $color-neg-soft;
  font-size: 13px;
  line-height: 1.55;
  color: $color-light-subtitle;

  b {
    color: $color-white;
  }
}

/* The swap widget keeps its width; the positions take the rest. */
.syc_grid {
  display: grid;
  grid-template-columns: minmax(0, 480px) minmax(0, 1fr);
  gap: 1.25rem;
  align-items: start;

  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr);
  }
}

.syc_card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;
}

.syc_head {
  margin-bottom: 0.5rem;

  &__right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
}

.syc_refresh.v-btn {
  text-transform: none;
  letter-spacing: 0;
}

/* Value first, its caption under it, as the NAV page writes its figures. */
.syc_fig {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;

  &__value {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-family: $font-mono;
    font-size: 13.5px;
    font-weight: 500;
    color: $color-white;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  &__label {
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &--inline {
    flex-direction: row;
    align-items: baseline;
    gap: 0.4rem;
  }

  &--wide {
    grid-column: span 2;
  }
}

.syc_holdings {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem 1rem;
  padding: 0.875rem 1rem;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  background: $color-card-background;
}

.syc_empty {
  padding: 1rem;
  text-align: center;
  font-family: $font-mono;
  font-size: 12px;
  color: $color-steel-blue;
  border: 1px dashed $color-line-2;
  border-radius: $default-border-radius;
}

/* One position. */
.syc_pos {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  background: $color-card-background;

  &__head {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  &__id {
    font-family: $font-mono;
    font-size: 12px;
    color: $color-steel-blue;
  }

  &__pair {
    font-size: 14px;
    font-weight: 600;
    color: $color-white;
  }

  &__link {
    margin-left: auto;
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: $color-cyan;
  }

  &__figs {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.6rem 1rem;

    @media (max-width: 700px) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  &__actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;

    .v-btn {
      text-transform: none;
      letter-spacing: 0;
    }
  }
}

.syc_tag {
  font-family: $font-mono;
  font-size: 10.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.1rem 0.45rem;
  border-radius: $default-border-radius;
  border: 1px solid $color-line-2;
  color: $color-steel-blue;

  &--on {
    color: $color-pos;
    border-color: $color-pos;
  }

  &--off {
    color: $color-warn;
    border-color: $color-warn-line;
  }
}

/* The remove panel under a position. */
.syc_panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid $color-line;

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  &__figs {
    justify-content: flex-start;
    gap: 2rem;
  }

  .v-btn {
    align-self: flex-start;
    text-transform: none;
    letter-spacing: 0;
  }
}

.syc_chips {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;

  &__note {
    margin-left: 0.4rem;
    font-family: $font-mono;
    font-size: 10.5px;
    color: $color-steel-blue;
  }
}

.syc_chip {
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

  &--on {
    background: $color-cyan;
    color: $color-dark;
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
}

/* New position. */
.syc_new {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.875rem 1rem 1rem;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  background: $color-card-background;

  &__title {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    font-size: 14px;
    font-weight: 600;
    color: $color-white;
  }

  &__pool {
    font-family: $font-mono;
    font-size: 11px;
    color: $color-steel-blue;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;

    @media (max-width: 560px) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  &__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  &__problem {
    font-family: $font-mono;
    font-size: 11.5px;
    color: $color-warn;
  }
}

.syc_field {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas: "label label" "input unit";
  align-items: center;
  gap: 0.3rem 0.5rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  background: $color-dark;

  &__label {
    grid-area: label;
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__input {
    grid-area: input;
    min-width: 0;
    min-height: 0;
    height: auto;
    padding: 0;
    border: 0;
    outline: none;
    background: transparent;
    font-family: $font-mono;
    font-size: 18px;
    font-weight: 500;
    color: $color-white;
    font-variant-numeric: tabular-nums;

    &::placeholder {
      color: $color-steel-blue;
    }

    &:disabled {
      color: $color-steel-blue;
    }
  }

  &__unit {
    grid-area: unit;
    font-family: $font-mono;
    font-size: 10.5px;
    color: $color-steel-blue;
    white-space: nowrap;
  }
}

/* The two swap amount boxes. */
.syc_box {
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

/* The amount: big, mono, tabular. The app's global input sizing is unset. */
.syc_amount {
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
    animation: syc_pulse 1.2s ease-in-out infinite;
  }
}

@keyframes syc_pulse {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 0.9;
  }
}

.syc_impact {
  font-style: normal;
  margin-left: 0.3rem;

  &--bad {
    color: $color-neg;
  }
}

.syc_picker {
  position: relative;
  flex: 0 0 auto;
}

.syc_token {
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
    color: $color-steel-blue;
    margin-right: -0.2rem;
  }

  &:hover &__chevron {
    color: $color-white;
  }
}

.syc_menu {
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

.syc_flip_row {
  display: flex;
  justify-content: center;
  height: 0;
  position: relative;
  z-index: 2;
}

.syc_flip {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  margin-top: -18px;
  border: 3px solid $color-surface;
  border-radius: $default-border-radius;
  background: $color-hover;
  color: $color-white;
  cursor: pointer;
  transition: color $default-transition-time ease, transform $default-transition-time ease;

  &:hover {
    color: $color-cyan;
    background: $color-moonlight-light;
    transform: rotate(180deg);
  }
}

.syc_summary {
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

.syc_kv {
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

  &--control {
    align-items: center;
    gap: 0.5rem;

    > span:last-child {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
  }
}

.syc_small_input {
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

.syc_link {
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

.syc_notice {
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

.syc_cta.v-btn {
  height: 52px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
  margin-top: 0.25rem;
}

.syc_done,
.syc_pending {
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

.syc_pending {
  color: $color-steel-blue;
  justify-content: center;

  a {
    color: $color-steel-blue;
  }
}
</style>
