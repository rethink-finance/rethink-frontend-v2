<template>
  <div class="brand_card dist">
    <div class="brand_card__head dist_head">
      <div class="brand_card__eyebrow">
        Distribution
      </div>
      <div class="brand_card__meta">
        {{ metaText }}
      </div>
    </div>

    <p class="dist_lead">
      SYC is minted to sniETH depositors by a contract, with nobody signing. It mints the SNI in the Safe that has no SYC
      against it, split by each depositor's sniETH, and never more SYC than there is SNI.
    </p>

    <div v-if="!distributor" class="dist_notice">
      The distributor contract is not deployed yet.
    </div>

    <template v-else>
      <div v-if="loadError" class="dist_row">
        <div class="dist_notice dist_notice--bad">
          {{ loadError }}
        </div>
        <v-btn
          variant="outlined"
          size="small"
          :disabled="loading"
          @click="load"
        >
          {{ loading ? "Loading…" : "Try again" }}
        </v-btn>
      </div>

      <template v-if="state">
        <div class="dist_facts">
          <span class="dist_kv"><span>Waiting</span><span>{{ syc(state.undistributed) }} SNI</span></span>
          <span class="dist_kv"><span>SYC supply</span><span>{{ syc(state.supply) }}</span></span>
          <span class="dist_kv"><span>SNI in the Safe</span><span>{{ syc(state.safeSni) }}</span></span>
          <span class="dist_kv">
            <span>Contract</span>
            <a :href="`${SYC.EXPLORER}/address/${distributor}`" target="_blank" rel="noopener noreferrer">{{ shortAddress(distributor) }}</a>
          </span>
        </div>

        <div
          v-for="blocker in blockers"
          :key="blocker"
          class="dist_notice"
        >
          {{ blocker }}
        </div>

        <!-- Who gets what on the next run -->
        <div class="dist_table_wrap">
          <table class="dist_table">
            <thead>
              <tr>
                <th>Depositor</th>
                <th>Share</th>
                <th>Next distribution</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in state.recipients" :key="r.wallet">
                <td>
                  <a :href="`${SYC.EXPLORER}/address/${r.wallet}`" target="_blank" rel="noopener noreferrer">{{ shortAddress(r.wallet) }}</a>
                </td>
                <td>{{ pct(r.share) }}</td>
                <td class="dist_table__key">
                  {{ syc(r.next) }} SYC
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="dist_row">
          <v-btn
            variant="outlined"
            size="small"
            :disabled="!canDistribute"
            @click="distribute"
          >
            {{ buttonText }}
          </v-btn>
          <v-btn
            variant="text"
            size="small"
            :disabled="loading"
            @click="load"
          >
            {{ loading ? "Loading…" : "Refresh" }}
          </v-btn>
          <span class="dist_made">It runs by itself; this button is only a manual nudge.</span>
        </div>
        <div v-if="act.error" class="dist_notice dist_notice--bad">
          {{ act.error }}
        </div>
        <div v-if="act.done" class="dist_done">
          <Icon icon="octicon:check-circle-fill-16" width="1rem" height="1rem" />
          <span>{{ act.done }}</span>
          <a
            v-if="act.hash"
            :href="`${SYC.EXPLORER}/tx/${act.hash}`"
            target="_blank"
            rel="noopener noreferrer"
          >view</a>
        </div>

        <!-- Every mint the contract has made -->
        <div class="dist_history">
          <div class="dist_history__title">
            Mints
            <span v-if="state.mintCount > mints.length">· latest {{ mints.length }} of {{ state.mintCount }}</span>
          </div>
          <div v-if="!mints.length" class="dist_notice">
            No mints yet.
          </div>
          <div v-else class="dist_table_wrap">
            <table class="dist_table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>To</th>
                  <th>SYC</th>
                  <th>Transaction</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in historyRows"
                  :key="row.key"
                  :class="row.mint ? 'dist_table__group' : 'dist_table__detail'"
                >
                  <td>{{ row.mint ? when(row.mint.time) : "" }}</td>
                  <td>
                    <template v-if="row.mint">
                      {{ row.mint.index === 0 ? "First issuance" : "Distribution" }}
                    </template>
                    <a
                      v-else
                      :href="`${SYC.EXPLORER}/address/${row.wallet}`"
                      target="_blank"
                      rel="noopener noreferrer"
                    >{{ shortAddress(row.wallet) }}</a>
                  </td>
                  <td>{{ syc(row.amount) }}</td>
                  <td>
                    <template v-if="row.mint">
                      <a
                        v-if="row.mint.tx"
                        :href="`${SYC.EXPLORER}/tx/${row.mint.tx}`"
                        target="_blank"
                        rel="noopener noreferrer"
                      >{{ shortAddress(row.mint.tx) }}</a>
                      <a
                        v-else
                        :href="`${SYC.EXPLORER}/block/${row.mint.block}`"
                        target="_blank"
                        rel="noopener noreferrer"
                      >block {{ row.mint.block }}</a>
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { shortAddress } from "~/composables/execution/oneInchSwap";
import { SYC, fmtUnits } from "~/composables/execution/sycConsole";
import {
  buildDistributeCall,
  distributionBlockers,
  distributorAddress,
  readDistributorState,
  readMints,
  type SycDistributorState,
  type SycMint,
} from "~/composables/execution/sycDistribution";
import { sendAsSafe } from "~/composables/permissions/useCuratorExecution";
import { simulateDirectCall } from "~/composables/permissions/useRoleExecution";
import { useAccountStore } from "~/store/account/account.store";

/**
 * The distributor contract, watched from the console: what is waiting, who
 * gets what next, and every mint it has made. Minting needs nobody here: a
 * keeper calls the contract. The one button is the same call, for a day the
 * keeper is late; whoever presses it has no say in the amounts.
 */
const accountStore = useAccountStore();
const distributor = distributorAddress();

const syc = (wei: bigint) => fmtUnits(wei, 18, 2);
const pct = (share: number) => (share > 0 && share < 0.0001 ? "< 0.01%" : `${(share * 100).toFixed(2)}%`);
const when = (seconds: number) =>
  new Date(seconds * 1000).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/* ----------------------------------------------------------------- reads */

const state = ref<SycDistributorState | null>(null);
const mints = ref<SycMint[]>([]);
const loading = ref(false);
const loadError = ref("");
const load = async () => {
  if (!distributor || loading.value) return;
  loading.value = true;
  try {
    const next = await readDistributorState();
    state.value = next;
    mints.value = await readMints(next.mintCount);
    loadError.value = "";
  } catch (error: any) {
    console.error(error);
    loadError.value = "Could not read the distributor contract. Try again.";
  } finally {
    loading.value = false;
  }
};
onMounted(load);

/** One table row per mint, followed by one per wallet it paid. */
const historyRows = computed(() =>
  mints.value.flatMap((mint) => [
    { key: `mint:${mint.index}`, mint, wallet: "", amount: mint.total },
    ...mint.rows.map((row) => ({ key: `${mint.index}:${row.wallet}`, mint: null, wallet: row.wallet, amount: row.amount })),
  ]),
);

const blockers = computed(() => (state.value ? distributionBlockers(state.value) : []));
const metaText = computed(() => {
  if (!distributor) return "Not deployed";
  if (!state.value) return "";
  return state.value.mintCount === 1 ? "1 mint so far" : `${state.value.mintCount} mints so far`;
});

/* -------------------------------------------------------- manual nudge */

type Phase = "idle" | "checking" | "signing" | "pending";
const blank = () => ({ phase: "idle" as Phase, hash: "", error: "", done: "" });
const act = reactive(blank());
const canDistribute = computed(
  () => !!state.value && !blockers.value.length && accountStore.isConnected && act.phase === "idle",
);
const buttonText = computed(() => {
  if (act.phase === "checking") return "Checking…";
  if (act.phase === "signing") return "Confirm in your wallet…";
  if (act.phase === "pending") return "Waiting for the transaction…";
  return "Distribute now";
});
const declined = (err: any) => {
  const message = err?.innerError?.message || err?.message || "";
  return err?.code === 4001 || err?.innerError?.code === 4001 || /user (denied|rejected)/i.test(message);
};

const distribute = async () => {
  const account = accountStore.activeAccountAddress;
  if (!state.value || !account || act.phase !== "idle") return;
  Object.assign(act, blank());
  try {
    act.phase = "checking";
    const call = buildDistributeCall();
    // Someone, usually the keeper, may have distributed since this page loaded.
    const simulation = await simulateDirectCall(SYC.CHAIN, account, call);
    if (!simulation.ok) {
      await load();
      throw new Error(blockers.value[0] || simulation.reason || "The contract would refuse this right now.");
    }
    const amount = state.value.undistributed;
    act.phase = "signing";
    const sent = await new Promise<boolean>((resolve, reject) => {
      sendAsSafe(SYC.CHAIN, call)
        .on("transactionHash", (hash: any) => {
          act.hash = String(hash);
          act.phase = "pending";
        })
        .on("receipt", (receipt: any) => {
          if (!receipt.status) reject(new Error("The transaction reverted on chain."));
          else resolve(true);
        })
        .catch((err: any) => (declined(err) ? resolve(false) : reject(err)));
    });
    if (!sent) return;
    act.done = `Distributed about ${syc(amount)} SYC.`;
    await load();
  } catch (error: any) {
    console.error(error);
    act.error = error?.message || "There has been an error.";
  } finally {
    act.phase = "idle";
  }
};
</script>

<style scoped lang="scss">
.dist {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dist_head {
  margin-bottom: 0.25rem;
}

.dist_lead {
  font-size: 13px;
  line-height: 1.55;
  color: $color-steel-blue;
  max-width: 78ch;
}

.dist_row {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  flex-wrap: wrap;

  .v-btn {
    text-transform: none;
    letter-spacing: 0;
  }
}

.dist_made {
  font-family: $font-mono;
  font-size: 12px;
  color: $color-steel-blue;
}

.dist_table_wrap {
  overflow-x: auto;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
}

.dist_table {
  width: 100%;
  border-collapse: collapse;
  font-family: $font-mono;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;

  th,
  td {
    padding: 0.6rem 0.85rem;
    text-align: right;
    white-space: nowrap;
    border-bottom: 1px solid $color-line-2;

    &:first-child {
      text-align: left;
    }
  }

  th {
    font-size: 10.5px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }

  td {
    color: $color-light-subtitle;
  }

  a {
    color: $color-cyan;
  }

  tr:last-child td {
    border-bottom: 0;
  }

  &__key {
    color: $color-white !important;
  }

  &__group td {
    color: $color-white;
    font-weight: 600;
  }

  &__detail td {
    border-bottom-color: transparent;
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;
  }
}

.dist_facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.75rem;
}

.dist_kv {
  display: flex;
  gap: 0.5rem;
  font-family: $font-mono;
  font-size: 12px;

  > :first-child {
    color: $color-steel-blue;
  }

  > :last-child {
    color: $color-white;
  }

  a {
    color: $color-cyan;
  }
}

.dist_notice {
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

.dist_history {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;

  &__title {
    font-family: $font-mono;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }
}

.dist_done {
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
</style>
