<template>
  <div class="doc_console">
    <!--
      Headline value, laid out as the vault overview's stat strip: the total
      carried at display size on the left, the state of the plan beside it. No
      card — it reads as page furniture.
    -->
    <div class="doc_summary">
      <div class="doc_summary__hero">
        <div class="doc_label doc_label--accent">
          Portfolio value
        </div>
        <div class="doc_summary__value_row">
          <span class="doc_summary__figure">{{ state ? fmtUsd(state.totalUsd) : "—" }}</span>
          <span class="doc_summary__unit">USD</span>
        </div>
      </div>

      <div class="doc_summary__divider" />

      <div class="doc_summary__breakdown">
        <div class="doc_stat">
          <div class="doc_label">
            Drift to close
          </div>
          <div class="doc_stat__value">
            {{ state ? "$" + fmtUsd(driftUsd) : "—" }}
          </div>
          <div class="doc_stat__sub">
            {{ steps.length ? steps.length + " transaction" + (steps.length === 1 ? "" : "s") : "plan not built" }}
          </div>
        </div>
        <div class="doc_stat">
          <div class="doc_label">
            Positions moving
          </div>
          <div class="doc_stat__value">
            {{ state ? movingCount : "—" }}
          </div>
          <div class="doc_stat__sub">
            of {{ positions.length || "—" }}
          </div>
        </div>
      </div>

      <v-btn
        class="doc_summary__refresh"
        variant="outlined"
        size="small"
        :loading="loadingState"
        @click="refresh"
      >
        Refresh
      </v-btn>
    </div>

    <div class="doc_layout">
      <div class="doc_main">
        <div class="group_title doc_section">
          Portfolio
          <span class="doc_toggle">
            <button
              v-for="mode in (['percent', 'tokens'] as const)"
              :key="mode"
              class="doc_toggle__btn"
              :class="{ 'doc_toggle__btn--on': targetMode === mode }"
              @click="targetMode = mode"
            >
              {{ mode === "percent" ? "Target %" : "Target amount" }}
            </button>
          </span>
        </div>

        <!--
          Where the money sits now against where it is going, at a glance and
          in one place: the two bars share a scale, so the difference between
          them is the work the plan below has to do.
        -->
        <div class="brand_card doc_card doc_alloc">
          <div class="doc_alloc__head">
            <div class="doc_label">
              Allocation
            </div>
            <div class="doc_alloc__total" :class="{ 'doc_alloc__total--bad': !targetsBalanced }">
              <span class="doc_dot" />
              Target totals {{ targetTotal.toFixed(1) }}%
            </div>
          </div>

          <div class="doc_alloc__bars">
            <div class="doc_alloc__bar_row">
              <span class="doc_label">Now</span>
              <div class="doc_bar">
                <span
                  v-for="row in rows"
                  :key="row.position.key"
                  class="doc_bar__seg"
                  :style="{ width: row.position.weight + '%', background: row.color }"
                  :title="`${row.position.label} · ${row.position.weight.toFixed(1)}%`"
                />
              </div>
            </div>
            <div class="doc_alloc__bar_row">
              <span class="doc_label">Target</span>
              <div class="doc_bar">
                <span
                  v-for="row in rows"
                  :key="row.position.key"
                  class="doc_bar__seg"
                  :style="{ width: row.target + '%', background: row.color }"
                  :title="`${row.position.label} · ${row.target.toFixed(1)}%`"
                />
              </div>
            </div>
          </div>

          <div class="doc_alloc__legend">
            <span v-for="row in rows" :key="row.position.key" class="doc_legend">
              <span class="doc_dot" :style="{ background: row.color }" />
              {{ row.position.label }}
            </span>
          </div>
        </div>

        <div class="brand_card doc_card">
          <div class="doc_rowgrid doc_rowgrid--head">
            <span>Position</span>
            <span class="doc_rowgrid__right">Current</span>
            <span>Target</span>
            <span class="doc_rowgrid__right">Delta</span>
            <span />
          </div>

          <div
            v-for="row in rows"
            :key="row.position.key"
            class="doc_rowgrid doc_prow"
            :style="{ '--doc-series': row.color }"
          >
            <div class="doc_prow__asset">
              <span class="doc_dot doc_dot--series" />
              <IconBaseAsset :symbol="row.position.token.symbol" :size="18" />
              <div class="doc_prow__names">
                <div class="doc_prow__name">
                  {{ row.position.label }}
                  <span v-if="row.position.inAave && state" class="doc_badge">
                    {{ state.aaveSupplyApr.toFixed(2) }}% APY
                  </span>
                </div>
                <div class="doc_prow__sub">
                  {{ fmtUnits(row.position.balance, row.position.token.decimals, 4) }}
                  {{ row.position.token.symbol }} · ${{ fmtUsd(row.position.price) }}
                </div>
              </div>
            </div>

            <div class="doc_prow__now doc_rowgrid__right">
              <div class="doc_prow__figure">
                {{ row.position.weight.toFixed(1) }}%
              </div>
              <div class="doc_prow__sub">
                {{ compactUsd(row.position.usd) }}
              </div>
            </div>

            <div class="doc_prow__target">
              <input
                class="doc_slider"
                type="range"
                min="0"
                max="100"
                step="0.1"
                :value="row.target"
                :disabled="!editable(row.position.key)"
                :style="{ '--doc-fill': Math.min(row.target, 100) + '%' }"
                :aria-label="`Target weight for ${row.position.label}`"
                @input="setTarget(row.position.key, Number(($event.target as HTMLInputElement).value))"
              >
              <span class="doc_field" :class="{ 'doc_field--off': !editable(row.position.key) }">
                <input
                  class="doc_field__input"
                  inputmode="decimal"
                  :value="boxText(row.position)"
                  :disabled="!editable(row.position.key)"
                  @input="onBoxInput(row.position, $event)"
                  @focus="($event.target as HTMLInputElement).select()"
                  @blur="drafts[row.position.key] = null"
                  @keydown.enter="($event.target as HTMLInputElement).blur()"
                >
                <span class="doc_field__unit">
                  {{ targetMode === "percent" ? "%" : row.position.token.symbol }}
                </span>
              </span>
            </div>

            <div
              class="doc_prow__delta doc_rowgrid__right"
              :class="row.trades ? (row.changeUsd > 0 ? 'doc_pos' : 'doc_neg') : ''"
            >
              <div class="doc_prow__figure">
                {{ row.trades ? (row.deltaPct > 0 ? "+" : "−") + Math.abs(row.deltaPct).toFixed(1) + "%" : "—" }}
              </div>
              <div class="doc_prow__sub">
                {{ row.trades ? (row.changeUsd > 0 ? "+" : "−") + compactUsd(row.changeUsd) : "no trade" }}
              </div>
            </div>

            <button
              class="doc_lock"
              :class="{ 'doc_lock--on': locked[row.position.key] }"
              :title="locked[row.position.key]
                ? 'Locked — the others rebalance around it'
                : 'Lock this weight'"
              @click="toggleLock(row.position.key)"
            >
              <Icon
                :icon="locked[row.position.key] ? 'material-symbols:lock' : 'material-symbols:lock-open-outline'"
                width="13"
                height="13"
              />
            </button>
          </div>

          <div class="doc_row doc_row--end">
            <span class="doc_tolerance">
              <span class="doc_label">Max slippage</span>
              <input v-model="tolerance" class="doc_input" inputmode="decimal">
              <span class="doc_input__unit">%</span>
            </span>
            <v-btn
              variant="text"
              size="small"
              class="doc_text_action"
              @click="resetTargets"
            >
              Reset to current
            </v-btn>
            <v-btn
              class="bg-primary text-secondary"
              size="small"
              :loading="building"
              :disabled="!state || !targetsBalanced"
              @click="buildPlan"
            >
              Build plan
            </v-btn>
          </div>
        </div>

      </div>

      <aside class="doc_aside">
        <!-- Carries the same section caption the left column does, so the panel
             below starts level with the first card over there. -->
        <div class="group_title doc_section">
          Transaction plan
          <!--
            The tooltip hangs off the wrapper, not the button: a disabled
            v-btn takes no pointer events, so an activator on the button
            itself would never fire — the same wrapping the page's other
            execute buttons use.
          -->
          <span v-if="steps.length" class="doc_section__action">
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

        <div v-if="!plan" class="brand_card doc_panel doc_panel--empty">
          <p class="doc_panel__intro">
            No plan built
          </p>
        </div>

        <template v-else>
          <div v-for="issue in issues" :key="issue" class="doc_warn">
            {{ issue }}
          </div>

          <div v-if="!steps.length" class="brand_card doc_card">
            <div class="doc_card__sub">
              Nothing to do — every position is already within $25 of its target.
            </div>
          </div>

          <div
            v-for="(step, i) in steps"
            :key="i"
            class="brand_card doc_card doc_step"
            :class="{ 'doc_step--done': step.status === 'ok', 'doc_step--busy': isBusy(step) }"
          >
            <div class="doc_step__head">
              <div class="doc_card__titles">
                <div class="brand_card__eyebrow">
                  {{ i + 1 }} · {{ step.label }}
                </div>
                <div class="doc_card__sub">
                  {{ stepStatusText(step) }}
                </div>
              </div>
              <div v-if="step.quote" class="doc_stat doc_stat--right">
                <div class="doc_label">
                  Impact
                </div>
                <div
                  class="doc_stat__value"
                  :class="step.quote.slippagePct < -Number(tolerance) ? 'doc_stat__value--bad' : ''"
                >
                  {{ step.quote.slippagePct.toFixed(2) }}%
                </div>
              </div>
            </div>

            <div v-for="p in step.inner?.params ?? []" :key="p.k" class="doc_param">
              <span>{{ p.k }}</span>
              <span>{{ p.v }}<em v-if="p.pinned" class="doc_pinned"> · pinned</em></span>
            </div>

            <!--
              A swap leg carries no calldata until 1inch has written one: the
              routing program is the pathfinder's, and role 1 may send nothing
              else. Everything the operator needs to ask for is spelled out
              here so the returned calldata can only be the right one.
            -->
            <div v-if="step.intent && !step.inner" class="doc_paste">
              <div class="doc_card__sub">
                Build this swap on 1inch with the receiver set to the Safe, then
                paste its <code>swap</code> calldata here.
              </div>
              <div class="doc_paste__intent">
                <div><span>sell</span><span>{{ fmtUnits(step.intent.amount, step.intent.sell.decimals) }} {{ step.intent.sell.symbol }}</span></div>
                <div><span>buy</span><span>{{ step.intent.buy.symbol }}</span></div>
                <div><span>receiver</span><span>{{ DOC.ADDR.safe }}</span></div>
              </div>
              <textarea
                v-model="step.paste"
                class="doc_paste__input"
                rows="3"
                spellcheck="false"
                placeholder="0x07ed2379…"
                @input="applyCalldata(step)"
              />
              <div v-for="problem in step.problems" :key="problem" class="doc_warn">
                {{ problem }}
              </div>
            </div>

            <details v-if="step.inner" class="doc_details">
              <summary>
                Calldata · to Roles {{ shortAddr(DOC.ADDR.roles) }} ·
                execTransactionWithRole(role {{ DOC.ROLE }})
                {{ docValidateWrapped(step.wrapped) ? "· 0x6928e74b ✓" : "· BAD PREFIX" }}
              </summary>
              <div class="doc_hex">
                {{ step.wrapped }}
              </div>
              <v-btn
                variant="text"
                size="small"
                class="doc_text_action"
                @click="copyText(step.wrapped, 'Calldata copied.')"
              >
                Copy calldata
              </v-btn>
            </details>

            <div v-if="step.error" class="doc_warn">
              {{ step.error }}
            </div>

            <div class="doc_step__actions">
              <a
                v-if="step.txHash"
                :href="DOC.EXPLORER + '/tx/' + step.txHash"
                target="_blank"
                rel="noopener noreferrer"
                :class="step.status === 'ok' ? 'doc_ok' : 'doc_mono_dim'"
              >
                {{ step.status === "ok" ? "✓ mined · view" : shortAddr(step.txHash) }}
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
                      {{ step.status === "ok" ? "Executed" : "Execute" }}
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
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import IconBaseAsset from "~/components/global/icon/BaseAsset.vue";
import {
  AAVE_KEY,
  DOC,
  type DocInner,
  type DocPlan,
  type DocPosition,
  type DocQuote,
  type DocState,
  type DocToken,
  type DocTrade,
  buildRebalancePlan,
  docInner,
  docOneInchSwap,
  docPositions,
  docReadState,
  docSafeBalance,
  parseDocSwap,
  validateDocSwap,
  type DocSwapIntent,
  docValidateWrapped,
  docWrappedPreview,
  findBestRoute,
  MIN_TRADE_USD,
  fmtUnits,
  fmtUsd,
  planClips,
  shortAddr,
  tradeToInner,
} from "~/composables/execution/docConsole";
import { useCuratorExecution } from "~/composables/permissions/useCuratorExecution";
import {
  RolesVersion,
  sendRoleExecution,
  simulateRoleExecution,
} from "~/composables/permissions/useRoleExecution";
import { useAccountStore } from "~/store/account/account.store";
import { useToastStore } from "~/store/toasts/toast.store";

const toastStore = useToastStore();
const accountStore = useAccountStore();

// Every action here acts with the Safe's authority: the curator signs from
// their own wallet and the vault's Roles modifier forwards the call. Only the
// gate comes from the shared layer — the send goes straight to
// sendRoleExecution, because the role and generation here are established
// facts (v1, role 1) and because that returns the PromiEvent synchronously,
// which the step's transactionHash/receipt handlers need.
const { canExecute, disabledReason } = useCuratorExecution();


const state = ref<DocState | null>(null);
const loadingState = ref(false);
const plan = ref<DocPlan | null>(null);
const issues = ref<string[]>([]);
const building = ref(false);
const running = ref(false);
const targetMode = ref<"percent" | "tokens">("percent");
/** Target weight per position, 0-100, always summing to 100. */
const targets = reactive<Record<string, number>>({});
/** A locked position is never moved to make room for another one. */
const locked = reactive<Record<string, boolean>>({});
/** What is in a target box while it is being typed into, before it rounds. */
const drafts = reactive<Record<string, string | null>>({});
const tolerance = ref("1");


type StepStatus = "idle" | "quoting" | "simulating" | "signing" | "pending" | "ok" | "failed";

interface DocStep {
  label: string;
  trade: DocTrade;
  /** Set on a swap; the Aave legs need no quote. */
  quote: DocQuote | null;
  /**
   * What a pasted swap has to match. Null on every leg this console can build
   * itself — approvals and the Aave deposits and withdrawals, all of which are
   * scoped for role 1 by name.
   */
  intent: DocSwapIntent | null;
  /** The operator's paste, and what is wrong with it. */
  paste: string;
  problems: string[];
  /** Null on a swap leg until its calldata arrives and validates. */
  inner: DocInner | null;
  wrapped: string;
  status: StepStatus;
  error: string;
  txHash: string | null;
}
const steps = ref<DocStep[]>([]);

const isBusy = (step: DocStep) =>
  ["quoting", "simulating", "signing", "pending"].includes(step.status);

const stepStatusText = (step: DocStep) => {
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
      if (step.intent && !step.inner) return "waiting for its 1inch calldata";
      return step.quote ? step.quote.route.label : step.inner?.sig ?? "";
  }
};

const planButtonTitle = computed(() => {
  if (steps.value.some((s) => s.intent && !s.inner)) {
    return "Every swap leg needs its 1inch calldata before the plan can run.";
  }
  return disabledReason.value;
});

/** A leg is runnable once it has calldata — pasted, or built here. */
const isReady = (step: DocStep) => !!step.inner;

const positions = computed<DocPosition[]>(() =>
  state.value ? docPositions(state.value) : [],
);

/**
 * One colour per position, so a row, the fill of its slider and its segment of
 * the allocation bar are visibly the same thing. The two DAI positions are two
 * shades of one hue — the same asset, in a different place.
 */
const SERIES: Record<string, string> = {
  WBTC: "#1f5fff",
  WETH: "#4e81ff",
  DAI: "#16c8ff",
  [AAVE_KEY]: "#2f9bbd",
  PAXG: "#808898",
};
const SERIES_FALLBACK = ["#1f5fff", "#4e81ff", "#16c8ff", "#2f9bbd", "#808898"];
const seriesColor = (key: string, index: number) =>
  SERIES[key] ?? SERIES_FALLBACK[index % SERIES_FALLBACK.length];

/** The tenth of a percent the column is shown and edited in. */
const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Put whatever rounding is left over on the largest of `keys`, so the column
 * adds to exactly 100 rather than to 99.9.
 */
const settle = (keys: string[]) => {
  if (!keys.length) return;
  const total = positions.value.reduce((sum, p) => sum + (targets[p.key] ?? 0), 0);
  const diff = round1(100 - total);
  if (!diff) return;
  const biggest = keys.reduce((a, b) => ((targets[a] ?? 0) >= (targets[b] ?? 0) ? a : b));
  targets[biggest] = Math.max(0, round1((targets[biggest] ?? 0) + diff));
};

/**
 * Start from where the portfolio already is — the zero-trade position. The
 * weights go in unrounded even though the column is shown to a tenth: rounding
 * five figures to 0.1% is worth a few hundred dollars of drift, and a screen
 * that opens already wanting to trade is a screen lying about the portfolio.
 * The tenth is the granularity of an edit, not of the reading underneath it.
 */
const initTargets = () => {
  const list = positions.value;
  if (!list.length) return;
  list.forEach((p) => {
    targets[p.key] = p.weight;
    drafts[p.key] = null;
  });
};

const unlockedCount = computed(
  () => positions.value.filter((p) => !locked[p.key]).length,
);

/**
 * A row can only move if something else is free to absorb the difference, so
 * the last unlocked row is read-only rather than silently refusing the drag.
 */
const editable = (key: string) => !locked[key] && unlockedCount.value > 1;

/**
 * Set one weight and let the others take up the slack, in proportion to where
 * they already sit. This is what makes an exact figure reachable: the number
 * typed is the number kept, and nobody has to hand-balance the remainder back
 * to 100.
 */
const setTarget = (key: string, value: number) => {
  const list = positions.value;
  const free = list.filter((p) => p.key !== key && !locked[p.key]).map((p) => p.key);
  if (!free.length) return;

  const lockedSum = list
    .filter((p) => p.key !== key && locked[p.key])
    .reduce((sum, p) => sum + (targets[p.key] ?? 0), 0);
  const room = Math.max(0, 100 - lockedSum);
  const next = Math.min(Math.max(isFinite(value) ? value : 0, 0), room);

  const rest = room - next;
  const freeNow = free.reduce((sum, k) => sum + (targets[k] ?? 0), 0);
  free.forEach((k) => {
    targets[k] = round1(
      freeNow > 0 ? ((targets[k] ?? 0) / freeNow) * rest : rest / free.length,
    );
  });
  targets[key] = next;
  settle(free);
};

const toggleLock = (key: string) => {
  locked[key] = !locked[key];
};

/**
 * What the target box shows: the weight itself, or the amount of the asset
 * that weight buys. Either way it is the same target — the box is just the
 * precise end of the same control the slider drives.
 */
const boxText = (position: DocPosition): string => {
  const draft = drafts[position.key];
  if (draft !== null && draft !== undefined) return draft;
  const percent = targets[position.key] ?? 0;
  if (targetMode.value === "percent") return percent.toFixed(1);
  const usd = (percent / 100) * (state.value?.totalUsd || 0);
  const units = position.price ? usd / position.price : 0;
  return units.toFixed(units >= 1000 ? 0 : units >= 1 ? 4 : 6);
};

const onBoxInput = (position: DocPosition, event: Event) => {
  const raw = (event.target as HTMLInputElement).value;
  drafts[position.key] = raw;
  const value = Number(raw.replace(/,/g, "").trim());
  if (!raw.trim() || !isFinite(value) || value < 0) return;
  if (targetMode.value === "percent") {
    setTarget(position.key, value);
    return;
  }
  const total = state.value?.totalUsd || 0;
  if (!total || !position.price) return;
  setTarget(position.key, ((value * position.price) / total) * 100);
};

const targetTotal = computed(() =>
  positions.value.reduce((sum, p) => sum + (targets[p.key] ?? 0), 0),
);

/** Half a percent of slack, so rounding a column of figures is not an error. */
const targetsBalanced = computed(
  () => !!state.value && Math.abs(targetTotal.value - 100) < 0.5,
);

/**
 * Thousands, in the width a table column has for them. The exact figure is
 * never far — it is on the step card that spends it — and at six digits the
 * cents only get in the way of comparing one row to the next.
 */
const compactUsd = (usd: number): string => {
  const abs = Math.abs(usd);
  if (abs >= 1000) return "$" + (abs / 1000).toFixed(abs >= 100000 ? 0 : 1) + "k";
  return "$" + abs.toFixed(abs >= 100 ? 0 : 2);
};

const rows = computed(() =>
  positions.value.map((position, index) => {
    const total = state.value?.totalUsd || 0;
    const target = targets[position.key] ?? position.weight;
    const changeUsd = (target / 100) * total - position.usd;
    return {
      position,
      color: seriesColor(position.key, index),
      target,
      deltaPct: target - position.weight,
      changeUsd,
      /** Below the dust threshold the plan will not trade it, so nor does the row. */
      trades: Math.abs(changeUsd) >= MIN_TRADE_USD,
    };
  }),
);

/** Live, not from the built plan — it is what the sliders are asking for. */
const driftUsd = computed(() =>
  rows.value.reduce((sum, r) => sum + (r.trades && r.changeUsd > 0 ? r.changeUsd : 0), 0),
);

const movingCount = computed(() => rows.value.filter((r) => r.trades).length);

const resetTargets = () => {
  positions.value.forEach((p) => (locked[p.key] = false));
  initTargets();
  plan.value = null;
  steps.value = [];
  issues.value = [];
};

/**
 * Targets survive a refresh: the screen re-reads balances after every executed
 * step, and wiping the operator's intent halfway through a plan would be
 * worse than a stale figure. Only a position the screen has never seen gets a
 * starting weight.
 */
watch(
  positions,
  (list) => {
    if (list.length && list.some((p) => targets[p.key] === undefined)) initTargets();
  },
  { immediate: true },
);

const refresh = async () => {
  loadingState.value = true;
  try {
    state.value = await docReadState();
  } catch (error) {
    console.error("Could not read the DoC portfolio", error);
    toastStore.errorToast("Could not read the vault's balances from Polygon.");
  } finally {
    loadingState.value = false;
  }
};

onMounted(refresh);

/* -------------------------------------------------------------------------- */
/* Plan                                                                        */
/* -------------------------------------------------------------------------- */

/** Past this an allowance reads as "set and forget" rather than a real number. */
const LARGE_ALLOWANCE = ethers.parseUnits("1000000000", 18);

const allowanceFor = (token: DocToken, spender: string) => {
  const holding = state.value?.holdings.find((h) => h.token.symbol === token.symbol);
  if (!holding) return 0n;
  return spender === DOC.ADDR.aavePool ? holding.aaveAllowance : holding.oneInchAllowance;
};

const priceOf = (symbol: string) =>
  state.value?.holdings.find((h) => h.token.symbol === symbol)?.price ?? 0;

const makeStep = (
  label: string,
  trade: DocTrade,
  inner: DocInner | null,
  quote: DocQuote | null = null,
  intent: DocSwapIntent | null = null,
): DocStep =>
  reactive({
    label,
    trade,
    quote,
    intent,
    paste: "",
    problems: [] as string[],
    inner,
    wrapped: inner ? docWrappedPreview(inner) : "",
    status: "idle" as StepStatus,
    error: "",
    txHash: null,
  }) as DocStep;

/**
 * Take the operator's paste and either turn it into this step's calldata or
 * say exactly why it is not this step's calldata. Both the permission's rules
 * and the leg's own numbers are checked here, so nothing that would revert in
 * the modifier ever reaches a wallet prompt.
 */
const applyCalldata = (step: DocStep) => {
  step.inner = null;
  step.wrapped = "";
  step.error = "";
  const hex = step.paste.trim();
  if (!hex || !step.intent) {
    step.problems = [];
    return;
  }
  let call;
  try {
    call = parseDocSwap(hex);
  } catch (error: any) {
    step.problems = [error?.message ?? "That calldata could not be read."];
    return;
  }
  step.problems = validateDocSwap(call, step.intent);
  if (step.problems.length) return;
  step.inner = docOneInchSwap(call, hex, step.intent.sell, step.intent.buy);
  step.wrapped = docWrappedPreview(step.inner);
};

const buildPlan = async () => {
  if (!state.value) return;
  building.value = true;
  steps.value = [];
  try {
    const built = buildRebalancePlan(state.value, { ...targets });
    plan.value = built;
    const found = [...built.issues];
    const list: DocStep[] = [];

    for (const trade of built.trades) {
      // Whatever the trade spends has to be spendable first. Today's
      // allowances are all unlimited, so this normally adds nothing — but a
      // revoked one would otherwise surface as an opaque inner revert.
      const spender = trade.kind === "aaveSupply" ? DOC.ADDR.aavePool : DOC.ADDR.oneInch;
      const spendToken = trade.kind === "aaveWithdraw" ? null : trade.sell ?? trade.token;
      if (
        spendToken &&
        spendToken.sellable &&
        allowanceFor(spendToken, spender) < LARGE_ALLOWANCE
      ) {
        const name = spender === DOC.ADDR.aavePool ? "Aave pool" : "1inch router";
        list.push(
          makeStep(
            `Approve ${spendToken.symbol} for the ${name}`,
            trade,
            docInner.approve(spendToken, spender, name),
          ),
        );
      }

      if (trade.kind !== "swap") {
        const inner = tradeToInner(trade);
        if (inner) list.push(makeStep(trade.label, trade, inner));
        continue;
      }

      const sell = trade.sell!;
      const buy = trade.buy!;
      const clips = await planClips(
        sell,
        buy,
        trade.amount,
        priceOf(sell.symbol),
        priceOf(buy.symbol),
        Number(tolerance.value) || 1,
      );
      if (!clips.length) {
        found.push(
          `No pool route could price ${trade.label.toLowerCase()} — the Safe may not hold enough ${sell.symbol} to quote against.`,
        );
        continue;
      }
      const tol = Number(tolerance.value) || 1;
      if (clips[0].slippagePct < -tol) {
        found.push(
          `${sell.symbol} → ${buy.symbol} still prices ${clips[0].slippagePct.toFixed(2)}% ` +
            `at ${clips.length > 1 ? `1/${clips.length} of the size` : "this size"}. ` +
            "On-chain liquidity for this pair is thin, and splitting further only adds gas — " +
            "the cost is mostly the pools' own fees.",
        );
      }
      clips.forEach((quote, index) => {
        const clipUsd =
          Number(ethers.formatUnits(quote.amountIn, sell.decimals)) * priceOf(sell.symbol);
        const label =
          clips.length === 1
            ? trade.label
            : `Sell $${fmtUsd(clipUsd)} of ${sell.symbol} for ${buy.symbol}` +
              ` — ${index + 1} of ${clips.length}`;
        list.push(
          makeStep(label, trade, null, quote, {
            sell,
            buy,
            amount: quote.amountIn,
          }),
        );
      });
    }

    issues.value = found;
    steps.value = list;
  } finally {
    building.value = false;
  }
};

/* -------------------------------------------------------------------------- */
/* Running a step                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The pasted program carries its own floor, written by the pathfinder that
 * built it, so there is nothing here to re-price — a stale quote fails on
 * `minReturn` rather than filling badly. What is worth re-checking is that the
 * calldata still matches the leg, in case the plan was rebuilt around it.
 */
const revalidate = (step: DocStep): boolean => {
  if (!step.intent || !step.inner) return true;
  const problems = validateDocSwap(parseDocSwap(step.inner.data), step.intent);
  step.problems = problems;
  if (problems.length) {
    step.error = problems[0];
    return false;
  }
  return true;
};

/**
 * A deposit is funded by the swaps in front of it, and those hand back a
 * little less than the plan's oracle-priced estimate — 0.25% on one leg, 0.79%
 * on another. Across a dozen legs that shortfall is real money, and the
 * deposit is the last step: sized at plan time it would revert on chain after
 * every swap had already been paid for. So it is re-sized against what the
 * Safe actually holds immediately before signing — the same discipline
 * revalidate() applies to a swap.
 */
const resize = async (step: DocStep): Promise<boolean> => {
  if (step.trade.kind !== "aaveSupply") return true;
  const held = await docSafeBalance(step.trade.token);
  if (held <= 0n) {
    step.error = `The Safe holds no ${step.trade.token.symbol} to deposit.`;
    return false;
  }
  if (held < step.trade.amount) {
    step.inner = docInner.aaveSupply(step.trade.token, held);
    step.wrapped = docWrappedPreview(step.inner);
    step.label = `Deposit ${fmtUnits(held, step.trade.token.decimals, 2)} ${step.trade.token.symbol} into Aave`;
  }
  return true;
};

/**
 * Dry-run before the wallet opens. A permission denial is fatal — the modifier
 * would reject it after signing anyway. An inner revert is not: eth_call sees
 * only current state, so a swap staged behind an unmined approve reads as
 * failing and then succeeds.
 */
const preflight = async (step: DocStep): Promise<boolean> => {
  step.status = "simulating";
  if (!step.inner) {
    step.error = "This leg has no calldata yet.";
    return false;
  }
  const result = await simulateRoleExecution(
    DOC.CHAIN,
    DOC.ADDR.roles,
    { to: step.inner.to, data: step.inner.data },
    DOC.ROLE,
    RolesVersion.V1,
  );
  if (result.ok || result.innerRevert) return true;
  step.error = result.reason || "The Roles modifier denied this call.";
  return false;
};

const send = (step: DocStep): Promise<boolean> =>
  new Promise((resolve) => {
    step.status = "signing";
    // preflight() has already refused a step without calldata.
    const inner = step.inner!;
    sendRoleExecution(
      DOC.CHAIN,
      DOC.ADDR.roles,
      { to: inner.to, data: inner.data },
      DOC.ROLE,
      RolesVersion.V1,
    )
      .on("transactionHash", (hash: any) => {
        step.txHash = hash;
        step.status = "pending";
      })
      .on("receipt", (receipt: any) => {
        step.status = receipt.status ? "ok" : "failed";
        if (!receipt.status) step.error = "The transaction reverted on chain.";
        resolve(!!receipt.status);
      })
      .on("error", (error: any) => {
        console.error(error);
        const message = error?.innerError?.message || error?.message || "";
        const declined =
          error?.code === 4001 ||
          error?.innerError?.code === 4001 ||
          /user (denied|rejected)/i.test(message);
        step.status = "failed";
        step.error = declined ? "" : message || "There has been an error.";
        resolve(false);
      });
  });

/** Re-price, dry-run, sign, wait — the whole of one step behind one press. */
const runStep = async (step: DocStep): Promise<boolean> => {
  if (step.status === "ok") return true;
  if (!accountStore.connectedWalletWeb3) {
    toastStore.errorToast("Connect your wallet.");
    return false;
  }
  step.error = "";
  try {
    // Every address on this screen is a Polygon one; the same calldata sent on
    // another chain would land on whatever sits at those addresses there.
    if (accountStore.connectedWalletChainId !== DOC.CHAIN) {
      await accountStore.switchNetwork(DOC.CHAIN);
    }
    if (!revalidate(step) || !(await resize(step)) || !(await preflight(step))) {
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

/**
 * The whole plan, in order, stopping at the first step that does not land.
 * Order is not cosmetic: an Aave withdrawal frees the DAI a later swap spends,
 * and a deposit is funded by the swaps in front of it.
 */
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
    toastStore.successToast("The portfolio is rebalanced.");
  } finally {
    running.value = false;
  }
};

const copyText = (text: string, message: string) => {
  navigator.clipboard.writeText(text);
  toastStore.addToast(message);
};
</script>

<style scoped lang="scss">
.doc_console {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  margin-bottom: 2.5rem;
}

/* The mono uppercase caption the whole design system labels figures with. */
.doc_label {
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

.doc_mono {
  font-family: $font-mono;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: $color-light-subtitle;
}

/**
 * Headline value. Same construction as the vault overview's stat strip — hero
 * figure keeping the left edge, hairline divider pushing the derived numbers
 * away from it, no card behind any of it.
 */
.doc_summary {
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

.doc_stat {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0;

  &--right {
    text-align: right;
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
.doc_section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.75rem;

  &:first-child {
    margin-top: 0;
  }

  /* The plan's own button rides in its heading, so the primary action is at
     the top of the list it acts on rather than below the last card. */
  &__action {
    margin-left: auto;
  }
}

/* A leg that cannot run yet, marked as one. */
.doc_paste {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px dashed rgba(255, 255, 255, 0.16);
  border-radius: 0.5rem;

  &__intent {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    font-family: monospace;
    font-size: 0.75rem;

    > div {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
    }

    span:first-child {
      opacity: 0.6;
    }
  }

  &__input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 0.375rem;
    background: rgba(0, 0, 0, 0.25);
    font-family: monospace;
    font-size: 0.7rem;
    line-height: 1.4;
    word-break: break-all;
    resize: vertical;
  }
}

/* Two states of one control, so it reads as a switch rather than two buttons. */
.doc_toggle {
  display: inline-flex;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  overflow: hidden;

  &__btn {
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.25rem 0.5rem;
    color: $color-steel-blue;
    cursor: pointer;
    transition: background-color $default-transition-time ease,
      color $default-transition-time ease;

    &--on {
      background: $color-cyan-tint;
      color: $color-cyan;
    }
  }
}

/* .brand_card supplies the chrome; this is only the internal rhythm. */
.doc_card {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;

  &__titles {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
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

/**
 * Targets on the left, the transactions they produce on the right — the same
 * split the CRT console uses, so the thing being edited and the thing being
 * signed never trade places. 440px is what a step card needs before its
 * parameter rows start wrapping mid-value.
 */
.doc_layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 440px;
  gap: 1.75rem;
  align-items: start;

  @media (max-width: 1240px) {
    grid-template-columns: 1fr;
  }
}

.doc_main {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

/**
 * Not sticky: a full rebalance runs to a dozen steps, so this column is the
 * taller of the two and pinning it would only fight the scroll. The left
 * column is short enough to keep in view on its own.
 */
.doc_aside {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

.doc_panel {
  &--empty {
    min-height: 140px;
    /* Centred rather than top-set: the slack should read as deliberate, not
       as a card that ran out of content. */
    display: grid;
    align-content: center;
  }

  /* A state label, not prose — the mono caption the rest of the app uses for
     "nothing here yet". */
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

/**
 * Now against target, on one scale. Two bars rather than a chart: the only
 * question being asked of them is which way each slice moves, and a length
 * answers that faster than an arc.
 */
.doc_alloc {
  gap: 1.125rem;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  &__total {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: $color-cyan;

    .doc_dot {
      background: $color-cyan;
    }

    /* Only reachable if the numbers are edited from outside the sliders —
       kept so a broken total can never pass for a balanced one. */
    &--bad {
      color: $color-neg;

      .doc_dot {
        background: $color-neg;
      }
    }
  }

  &__bars {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  &__bar_row {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr);
    align-items: center;
    gap: 0.75rem;
  }

  &__legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.125rem;
  }
}

.doc_bar {
  display: flex;
  height: 10px;
  border-radius: 3px;
  overflow: hidden;
  background: $color-gray-light-transparent;

  &__seg {
    height: 100%;
    /* The target bar redraws on every tenth of a percent, so it moves with the
       slider rather than snapping after it. */
    transition: width $default-transition-time ease;

    & + & {
      border-left: 1px solid $color-dark;
    }
  }
}

.doc_legend {
  display: inline-flex;
  align-items: center;
  gap: 0.4375rem;
  font-family: $font-mono;
  font-size: 11px;
  color: $color-steel-blue;
}

.doc_dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: 0 0 auto;
  background: $color-steel-blue;

  &--series {
    background: var(--doc-series);
  }
}

/**
 * One grid shared by the header and every position, so the columns line up
 * without a table — the target cell holds a slider and a field, which a table
 * cell sizes badly.
 */
.doc_rowgrid {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) 76px minmax(190px, 1.5fr) 84px 24px;
  align-items: center;
  gap: 0 1rem;

  &--head {
    padding-bottom: 0.625rem;
    border-bottom: 1px solid $color-line;
    font-family: $font-mono;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  &__right {
    text-align: right;
  }
}

.doc_prow {
  padding: 0.6875rem 0;
  border-bottom: 1px solid $color-line;

  &:last-of-type {
    border-bottom: 0;
    padding-bottom: 0;
  }

  &__asset {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  &__names {
    min-width: 0;
  }

  &__name {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 13px;
    font-weight: 600;
    color: $color-white;
  }

  /* Figures are mono and tabular so a column of them can be read down. */
  &__figure {
    font-family: $font-mono;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    color: $color-white;
  }

  &__sub {
    font-family: $font-mono;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    color: $color-steel-blue;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__target {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  /* The delta colours its figure, not its caption — the caption is the same
     "no trade"/amount line the other columns carry. */
  &__delta.doc_pos .doc_prow__figure {
    color: $color-pos;
  }

  &__delta.doc_neg .doc_prow__figure {
    color: $color-neg;
  }
}

/* Where a position earns while it sits there, said on the position itself. */
.doc_badge {
  font-family: $font-mono;
  font-size: 9.5px;
  letter-spacing: 0.04em;
  padding: 0.125rem 0.3125rem;
  border-radius: 3px;
  color: $color-yield;
  background: $color-yield-soft;
  border: 1px solid $color-yield-line;
  white-space: nowrap;
}

/**
 * The coarse half of the target control. It carries its row's colour so the
 * fill, the dot beside the name and the segment in the bar above all read as
 * the same position. Native range input, so the arrow keys give the 0.1% step
 * the typed field would otherwise be the only way to reach.
 */
/* One thumb, drawn the same for both engines' pseudo-elements. */
@mixin doc_thumb {
  width: 13px;
  height: 13px;
  border: 0;
  border-radius: 50%;
  background: $color-white;
  cursor: grab;
  box-shadow: 0 0 0 3px $color-dark;
  transition: box-shadow $default-transition-time ease;
}

.doc_slider {
  flex: 1 1 auto;
  min-width: 0;
  /* The app sets a 2.5rem min-height and a padding on every input; a track has
     to unset both, not just set a height over them. */
  min-height: 0;
  height: 4px;
  padding: 0;
  appearance: none;
  -webkit-appearance: none;
  border-radius: 2px;
  background: linear-gradient(
    to right,
    var(--doc-series) 0 var(--doc-fill),
    $color-line-2 var(--doc-fill) 100%
  );
  outline: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    @include doc_thumb;
  }

  &::-moz-range-thumb {
    @include doc_thumb;
  }

  &:focus-visible::-webkit-slider-thumb {
    box-shadow: 0 0 0 3px $color-dark, 0 0 0 5px $color-cyan-line;
  }

  &:focus-visible::-moz-range-thumb {
    box-shadow: 0 0 0 3px $color-dark, 0 0 0 5px $color-cyan-line;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

/* The exact half of the same control: whatever is typed here is the weight
   that is kept, and the other rows move to make it add up. */
.doc_field {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 0.25rem;
  padding: 0.25rem 0.4375rem;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  background: $color-card-background;
  transition: border-color $default-transition-time ease;

  &:focus-within {
    border-color: $color-cyan-line;
  }

  &--off {
    opacity: 0.4;
  }

  &__input {
    width: 46px;
    /* Same unset as the slider — the field draws its own frame, so the input
       inside it carries no box of its own. */
    min-height: 0;
    height: auto;
    padding: 0;
    background: transparent;
    border: 0;
    outline: none;
    text-align: right;
    font-family: $font-mono;
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
    color: $color-white;
  }

  &__unit {
    font-family: $font-mono;
    font-size: 10px;
    color: $color-steel-blue;
  }
}

.doc_lock {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid transparent;
  color: $color-steel-blue;
  cursor: pointer;
  transition: color $default-transition-time ease,
    background-color $default-transition-time ease,
    border-color $default-transition-time ease;

  &:hover {
    color: $color-white;
    background: $color-gray-light-transparent;
  }

  &--on {
    color: $color-cyan;
    background: $color-cyan-tint;
    border-color: $color-cyan-line;
  }
}

/* Narrow: the row keeps its reading columns side by side and drops the
   control onto its own line, which is the one part that cannot compress. */
@media (max-width: 760px) {
  .doc_rowgrid--head {
    display: none;
  }

  .doc_prow {
    grid-template-columns: minmax(0, 1fr) auto 24px;
    grid-template-areas:
      "asset now lock"
      "target target target"
      "delta delta delta";
    row-gap: 0.75rem;

    &__asset {
      grid-area: asset;
    }

    &__now {
      grid-area: now;
    }

    &__target {
      grid-area: target;
    }

    &__delta {
      grid-area: delta;
      text-align: left;
    }
  }

  .doc_lock {
    grid-area: lock;
  }
}

/* The design's inset field, at the size a table cell can carry. */
.doc_input {
  width: 72px;
  min-height: 0;
  height: auto;
  background: $color-card-background;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  color: $color-white;
  font-family: $font-mono;
  font-size: 12.5px;
  text-align: right;
  padding: 0.3125rem 0.5rem;
  outline: none;
  transition: border-color $default-transition-time ease;

  &::placeholder {
    color: $color-steel-blue;
  }

  &:focus {
    border-color: $color-cyan-line;
  }

  &__unit {
    display: inline-block;
    width: 50px;
    margin-left: 0.375rem;
    font-family: $font-mono;
    font-size: 11px;
    color: $color-steel-blue;
    text-align: left;
  }
}

/* Sits with the buttons it qualifies, not in the table it bounds. */
.doc_tolerance {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-right: auto;

  .doc_input {
    width: 56px;
  }

  .doc_input__unit {
    width: auto;
    margin-left: 0;
  }
}

.doc_row {
  display: flex;
  gap: 0.625rem;
  align-items: center;
  flex-wrap: wrap;

  &--end {
    justify-content: flex-end;
  }
}

.doc_pos {
  color: $color-pos;
}

.doc_neg {
  color: $color-neg;
}

.doc_warn {
  border: 1px solid $color-neg-line;
  background: $color-neg-soft;
  border-radius: $default-border-radius;
  padding: 0.5625rem 0.75rem;
  font-size: 12.5px;
  line-height: 1.5;
  color: $color-neg;
}

.doc_step {
  transition: border-color $default-transition-time ease,
    opacity $default-transition-time ease;

  /* A finished step stays legible but stops competing with the one still to
     do — the list is a queue, and the eye should land on its front. */
  &--done {
    opacity: 0.55;
  }

  &--busy {
    border-color: $color-cyan-line;
  }

  /* No wrap: in a 440px column a two-line step title would otherwise push the
     impact figure onto its own row, where a right-aligned box sized to its
     content reads as left-aligned. The title wraps inside its own cell
     instead. */
  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: nowrap;

    .doc_card__titles {
      flex: 1 1 auto;
    }

    .doc_stat {
      flex: 0 0 auto;
    }
  }

  &__actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    align-items: center;
    flex-wrap: wrap;
  }
}

.doc_param {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-family: $font-mono;
  font-size: 12px;

  span:first-child {
    color: $color-steel-blue;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
}

.doc_pinned {
  font-style: normal;
  color: $color-text-irrelevant;
  font-size: 10.5px;
}

/* Calldata is proof, not a control: folded away until someone wants to read
   it, rather than taking a third of every step card. */
.doc_details {
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

.doc_hex {
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

.doc_mono_dim {
  font-family: $font-mono;
  font-size: 11px;
  color: $color-steel-blue;
  word-break: break-all;
  text-decoration: none;
}

.doc_text_action.v-btn {
  color: $color-cyan !important;
  font-weight: 600;
}

.doc_ok {
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
