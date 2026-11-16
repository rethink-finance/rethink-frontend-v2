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
      Weekly SYC mint to sniETH depositors. The amounts refresh every three hours; signers of the admin multisig are told
      when a mint is due (switch on Telegram under the bell, signed in with your signer wallet).
    </p>

    <div class="dist_row">
      <v-btn
        variant="outlined"
        size="small"
        :disabled="busy || loading"
        @click="load"
      >
        {{ loading ? "Loading…" : "Refresh" }}
      </v-btn>
      <span v-if="dist" class="dist_made">Computed {{ madeText }}</span>
    </div>
    <div v-if="loadError" class="dist_notice" :class="{ 'dist_notice--bad': !warming }">
      {{ loadError }}
    </div>
    <div v-if="dist && dist.total === 0n" class="dist_notice">
      Nothing is due: every wallet has received what it is owed.
    </div>

    <template v-if="dist">
      <div class="dist_table_wrap">
        <table class="dist_table">
          <thead>
            <tr>
              <th>Wallet</th>
              <th>Owed in total</th>
              <th>Already minted</th>
              <th>Mint now</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in dist.rows" :key="row.wallet">
              <td>
                <a :href="`${SYC.EXPLORER}/address/${row.wallet}`" target="_blank" rel="noopener noreferrer">{{ shortAddress(row.wallet) }}</a>
              </td>
              <td>{{ syc(row.owed) }}</td>
              <td>{{ syc(row.minted) }}</td>
              <td class="dist_table__key">
                {{ syc(row.mint) }}
              </td>
            </tr>
            <tr class="dist_table__total">
              <td>Total</td>
              <td />
              <td />
              <td>{{ syc(dist.total) }} SYC</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="chain" class="dist_facts">
        <span class="dist_kv"><span>Allowance available</span><span>{{ syc(chain.available) }} SYC</span></span>
        <span class="dist_kv"><span>SNI in the Safe</span><span>{{ syc(chain.safeSni) }}</span></span>
        <span class="dist_kv"><span>SYC after this mint</span><span>{{ syc(chain.supply + dist.total) }}</span></span>
      </div>

      <div v-for="problem in problems" :key="problem" class="dist_notice dist_notice--bad">
        {{ problem }}
      </div>
      <div v-if="shortfall > 0n" class="dist_notice">
        After this mint there would be {{ syc(shortfall) }} more SYC than SNI in the Safe.
      </div>

      <v-btn
        class="bg-primary text-secondary dist_cta"
        variant="flat"
        :disabled="!canPropose"
        @click="propose"
      >
        {{ buttonText }}
      </v-btn>

      <div v-if="act.error" class="dist_notice dist_notice--bad">
        {{ act.error }}
      </div>
      <div v-if="act.done" class="dist_done">
        <Icon icon="octicon:check-circle-fill-16" width="1rem" height="1rem" />
        <span>{{ act.done }}</span>
        <a
          v-if="act.hash && !act.multisig"
          :href="`${SYC.EXPLORER}/tx/${act.hash}`"
          target="_blank"
          rel="noopener noreferrer"
        >view</a>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { shortAddress } from "~/composables/execution/oneInchSwap";
import { SYC, fmtUnits } from "~/composables/execution/sycConsole";
import {
  DIST_IF,
  SYC_DIST,
  buildMintCall,
  distributionProblems,
  distributionShortfall,
  isContractAccount,
  parseDistribution,
  readDistributionChain,
  type SycDistribution,
  type SycDistributionChain,
} from "~/composables/execution/sycDistribution";
import {
  sendCuratorTransaction,
  simulateCuratorTransaction,
  type ICuratorRoute,
} from "~/composables/permissions/useCuratorExecution";
import { RolesVersion, type IRoleSimulationResult } from "~/composables/permissions/useRoleExecution";
import { fetchSycDistribution } from "~/services/backend/sycDistribution";
import { useAccountStore } from "~/store/account/account.store";

/**
 * The weekly mint, proposed from the app. The connected account has to hold
 * the admin role on the vault's Roles modifier; today that is one multisig,
 * so a signer connects as that Safe (Safe{Wallet} or WalletConnect) and the
 * transaction lands in its queue for the other signers.
 */
const accountStore = useAccountStore();
const ADMIN_ROUTE: ICuratorRoute = {
  chainId: SYC.CHAIN,
  rolesModAddress: SYC.ADDR.roles,
  role: SYC_DIST.ROLE,
  version: RolesVersion.V2,
};

const syc = (wei: bigint) => fmtUnits(wei, 18, 2);

/* ---------------------------------------------------------- distribution */

const dist = ref<SycDistribution | null>(null);
const loading = ref(false);
const loadError = ref("");
const warming = ref(false);
const load = async () => {
  if (loading.value) return;
  loading.value = true;
  loadError.value = "";
  warming.value = false;
  Object.assign(act, blank());
  try {
    const answer = await fetchSycDistribution();
    if (!answer.ok) {
      dist.value = null;
      warming.value = answer.warming;
      loadError.value = answer.warming
        ? "The backend is still computing the distribution. Try again in a few minutes."
        : "The distribution is not available right now: the backend did not answer.";
      return;
    }
    dist.value = parseDistribution(answer.text);
    await refreshChain();
  } catch (error: any) {
    dist.value = null;
    loadError.value = error?.message || "The distribution could not be read.";
  } finally {
    loading.value = false;
  }
};
const madeText = computed(() =>
  dist.value
    ? new Date(dist.value.generatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "",
);

/* ----------------------------------------------------------------- chain */

const chain = ref<SycDistributionChain | null>(null);
const chainError = ref("");
const refreshChain = async () => {
  try {
    chain.value = await readDistributionChain();
    chainError.value = "";
  } catch (error: any) {
    console.error(error);
    chainError.value = "Could not read the vault's state. Try again.";
  }
};
onMounted(async () => {
  await refreshChain();
  await load();
});

const metaText = computed(() => (chain.value ? `${syc(chain.value.available)} SYC allowance` : ""));
const problems = computed(() => {
  if (!dist.value) return [];
  if (!chain.value) return chainError.value ? [chainError.value] : [];
  return distributionProblems(dist.value, chain.value, Date.now());
});
const shortfall = computed(() => (dist.value && chain.value ? distributionShortfall(dist.value, chain.value) : 0n));

/* ------------------------------------------------------------ membership */

type Membership = "unknown" | "member" | "stranger";
const membership = ref<Membership>("unknown");
/** A mint to nobody: the admin role allows it, so only a wallet without the role is turned away at the door. */
const probe = {
  to: SYC.ADDR.fund,
  data: DIST_IF.fund.encodeFunctionData("fundFlowsCall", [DIST_IF.flows.encodeFunctionData("mintToMany", [[], []])]),
};
watch(
  () => accountStore.activeAccountAddress,
  async (account) => {
    membership.value = "unknown";
    if (!account) return;
    const result = await simulateCuratorTransaction(probe, ADMIN_ROUTE).catch(() => null);
    if (account !== accountStore.activeAccountAddress || !result) return;
    membership.value = result.noMembership ? "stranger" : "member";
  },
  { immediate: true },
);

/* --------------------------------------------------------------- propose */

type Phase = "idle" | "checking" | "signing" | "pending";
const blank = () => ({ phase: "idle" as Phase, hash: "", error: "", done: "", multisig: false });
const act = reactive(blank());
const busy = computed(() => act.phase !== "idle");

const canPropose = computed(
  () =>
    !!dist.value &&
    dist.value.total > 0n &&
    !!chain.value &&
    accountStore.isConnected &&
    membership.value !== "stranger" &&
    !problems.value.length &&
    !busy.value &&
    !act.done,
);
const buttonText = computed(() => {
  if (act.phase === "checking") return "Checking…";
  if (act.phase === "signing") return "Confirm in your wallet…";
  if (act.phase === "pending") return "Waiting for the transaction…";
  if (act.done) return "Done";
  if (!accountStore.isConnected) return "Connect a wallet to propose";
  if (membership.value === "stranger") return "Connect as the admin multisig";
  return "Propose mint";
});

const declined = (err: any) => {
  const message = err?.innerError?.message || err?.message || "";
  return err?.code === 4001 || err?.innerError?.code === 4001 || /user (denied|rejected)/i.test(message);
};
const explain = (simulation: IRoleSimulationResult): string => {
  if (simulation.noMembership) {
    return `${shortAddress(accountStore.activeAccountAddress || "")} does not hold the admin role. Connect as the admin multisig.`;
  }
  if (simulation.innerRevert) {
    return `The role allows this mint, but the vault would refuse it right now${simulation.reason ? ": " + simulation.reason : "."}`;
  }
  return simulation.reason || "The Roles modifier refuses this mint.";
};

const propose = async () => {
  const account = accountStore.activeAccountAddress;
  if (!dist.value || !account || busy.value) return;
  Object.assign(act, blank());
  try {
    act.phase = "checking";
    if (!accountStore.connectedWalletWeb3) throw new Error("Connect your wallet.");
    if (accountStore.connectedWalletChainId !== SYC.CHAIN) await accountStore.switchNetwork(SYC.CHAIN);
    // The chain as it is now, not as it was when the file was loaded.
    await refreshChain();
    if (problems.value.length) throw new Error(problems.value[0]);

    const call = buildMintCall(dist.value);
    const simulation = await simulateCuratorTransaction(call, ADMIN_ROUTE);
    if (!simulation.ok) throw new Error(explain(simulation));
    act.multisig = await isContractAccount(account);

    act.phase = "signing";
    const sent = await new Promise<boolean>((resolve, reject) => {
      sendCuratorTransaction(call, ADMIN_ROUTE)
        .on("transactionHash", (hash: any) => {
          act.hash = String(hash);
          // A multisig's transaction is mined only after the other signers confirm: proposing is the whole job here.
          if (act.multisig) resolve(true);
          else act.phase = "pending";
        })
        .on("receipt", (receipt: any) => {
          if (!receipt.status) reject(new Error("The transaction reverted on chain."));
          else resolve(true);
        })
        .catch((err: any) => (declined(err) ? resolve(false) : reject(err)));
    });
    if (!sent) return;
    act.done = act.multisig
      ? `Proposed ${syc(dist.value.total)} SYC. The other signers confirm it in the Safe.`
      : `Minted ${syc(dist.value.total)} SYC.`;
    if (!act.multisig) await refreshChain();
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
  max-width: 70ch;
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

  &__total td {
    color: $color-white;
    font-weight: 600;
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

  span:first-child {
    color: $color-steel-blue;
  }

  span:last-child {
    color: $color-white;
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

.dist_cta.v-btn {
  align-self: flex-start;
  height: 44px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
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
