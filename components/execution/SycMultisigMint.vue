<template>
  <div class="brand_card mint">
    <div class="brand_card__head mint_head">
      <div class="brand_card__eyebrow">
        Distribution
      </div>
      <div class="brand_card__meta">
        {{ metaText }}
      </div>
    </div>

    <p class="mint_lead">
      Until the distributor contract is reviewed, the admin multisig mints SYC to sniETH depositors. This works out
      what each one is owed, the way <code>weekly.mjs</code> does, and files the mint with the admin Safe in one
      signature.
    </p>

    <div v-if="loadError" class="mint_row">
      <div class="mint_notice mint_notice--bad">
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

    <div v-if="!state && loading" class="mint_notice">
      Reading the Safe, the vault's mints and the Roles modifier…
    </div>

    <template v-if="state">
      <!-- The one number that matters -->
      <div class="mint_due">
        <div class="mint_due__value">
          {{ state.plan.totalDue > 0n ? `${syc(state.plan.totalDue)} SYC` : "Nothing to mint" }}
        </div>
        <div class="mint_due__label">
          {{ state.plan.totalDue > 0n ? `to mint now, to ${state.plan.recipients.length} ${state.plan.recipients.length === 1 ? "wallet" : "wallets"}` : "everything owed has been minted" }}
        </div>
      </div>

      <div class="mint_table_wrap">
        <table class="mint_table">
          <thead>
            <tr>
              <th>Depositor</th>
              <th>Owed in total</th>
              <th>Minted</th>
              <th>Mint now</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in state.plan.rows" :key="r.wallet">
              <td>
                <a :href="`${SYC.EXPLORER}/address/${r.wallet}`" target="_blank" rel="noopener noreferrer">{{ shortAddress(r.wallet) }}</a>
              </td>
              <td>{{ syc(r.owed) }}</td>
              <td>{{ syc(r.minted) }}</td>
              <td class="mint_table__key">
                {{ syc(r.due) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mint_facts">
        <span class="mint_kv"><span>SNI in the Safe</span><span>{{ syc(state.safeSni) }}</span></span>
        <span class="mint_kv"><span>SYC after the mint</span><span>{{ syc(state.supply + state.plan.totalDue) }}</span></span>
        <span class="mint_kv">
          <span>{{ state.spare >= 0n ? "SNI spare" : "SNI short" }}</span>
          <span :class="{ 'mint_neg': state.spare < 0n }">{{ syc(state.spare >= 0n ? state.spare : -state.spare) }}</span>
        </span>
        <span class="mint_kv"><span>New since the one-off</span><span>{{ newSinceText }}</span></span>
        <span v-if="state.plan.flows.unswappedWeth > 0n" class="mint_kv">
          <span>Yield waiting as WETH</span><span>{{ fmtUnits(state.plan.flows.unswappedWeth, 18, 4) }}</span>
        </span>
        <span v-if="lastDistribution" class="mint_kv">
          <span>Last mint</span>
          <a :href="`${SYC.EXPLORER}/tx/${lastDistribution.tx}`" target="_blank" rel="noopener noreferrer">
            {{ syc(lastDistribution.total) }} SYC · block {{ lastDistribution.block }}
          </a>
        </span>
      </div>

      <div class="mint_checks">
        <span class="mint_check" :class="state.check.mint === 'pass' ? 'mint_check--ok' : 'mint_check--bad'">
          <Icon :icon="state.check.mint === 'pass' ? 'octicon:check-16' : 'octicon:x-16'" width="0.875rem" />
          Mint dry run
        </span>
        <span class="mint_check" :class="state.check.permission === 'pass' ? 'mint_check--ok' : 'mint_check--bad'">
          <Icon :icon="state.check.permission === 'pass' ? 'octicon:check-16' : 'octicon:x-16'" width="0.875rem" />
          Admin multisig may send it
        </span>
      </div>

      <div v-if="state.plan.flags.length" class="mint_attention">
        <div class="mint_attention__title">
          Needs attention
        </div>
        <ul>
          <li v-for="flag in state.plan.flags" :key="flag">
            {{ flag }}
          </li>
        </ul>
      </div>

      <!-- A proposal for this exact mint is already waiting: point at it, do not file a second one. -->
      <div v-if="queued" class="mint_done">
        <Icon icon="octicon:check-circle-fill-16" width="1rem" height="1rem" />
        <span>
          In the admin Safe's queue (nonce {{ queued.nonce }}), {{ queued.confirmations }} of {{ queued.required || adminSafe?.threshold || "?" }} signatures.
        </span>
        <a :href="safeWalletUrl(SYC.CHAIN, SYC_MINT.ADMIN_SAFE, queued.safeTxHash)" target="_blank" rel="noopener noreferrer">Open in Safe{Wallet}</a>
      </div>

      <div v-if="state.plan.totalDue > 0n" class="mint_row">
        <v-btn
          v-if="!queued"
          color="primary"
          size="small"
          class="mint_btn"
          :disabled="!!proposeDisabledReason || act.phase !== 'idle'"
          :title="proposeDisabledReason"
          @click="propose"
        >
          {{ proposeText }}
        </v-btn>
        <v-btn
          variant="outlined"
          size="small"
          class="mint_btn"
          @click="download"
        >
          Download Transaction Builder file
        </v-btn>
        <v-btn
          variant="text"
          size="small"
          class="mint_btn"
          :disabled="loading"
          @click="load"
        >
          {{ loading ? "Loading…" : "Refresh" }}
        </v-btn>
      </div>
      <div v-else class="mint_row">
        <v-btn
          variant="text"
          size="small"
          class="mint_btn"
          :disabled="loading"
          @click="load"
        >
          {{ loading ? "Loading…" : "Refresh" }}
        </v-btn>
      </div>
      <div v-if="state.plan.totalDue > 0n && !queued" class="mint_hint">
        {{ proposeHint }}
      </div>

      <div v-if="act.error" class="mint_notice mint_notice--bad">
        {{ act.error }}
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { shortAddress } from "~/composables/execution/oneInchSwap";
import { SYC, fmtUnits } from "~/composables/execution/sycConsole";
import {
  SYC_MINT,
  buildRoleCall,
  findQueuedProposal,
  readMintState,
  transactionBuilderFile,
  type SycMintState,
} from "~/composables/execution/sycMultisigMint";
import {
  buildSafeTx,
  fetchNextSafeNonce,
  fetchSafeInfo,
  proposeSafeTx,
  safeWalletUrl,
  signSafeTx,
  type ISafeInfo,
} from "~/composables/safe/safeTransactionService";
import { useAccountStore } from "~/store/account/account.store";
import { useToastStore } from "~/store/toasts/toast.store";

/**
 * The admin multisig's weekly SYC mint, from the console: what is owed, the
 * checks weekly.mjs makes, and the mint filed with the admin Safe under one
 * owner's signature. The other owners sign and execute it in Safe{Wallet}.
 */
const accountStore = useAccountStore();
const toastStore = useToastStore();

const syc = (wei: bigint) => fmtUnits(wei, 18, 4);
const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/* ----------------------------------------------------------------- reads */

const state = ref<SycMintState | null>(null);
const loading = ref(false);
const loadError = ref("");
const adminSafe = ref<ISafeInfo | null>(null);
const queued = ref<Awaited<ReturnType<typeof findQueuedProposal>>>(null);

const load = async () => {
  if (loading.value) return;
  loading.value = true;
  try {
    const next = await readMintState();
    state.value = next;
    loadError.value = "";
    queued.value = next.plan.totalDue > 0n
      ? await findQueuedProposal(buildRoleCall(next.plan.amounts, next.plan.recipients).data).catch(() => null)
      : null;
  } catch (error: any) {
    console.error(error);
    loadError.value = "Could not read the Safe and the vault's mints. Try again.";
  } finally {
    loading.value = false;
  }
};
onMounted(() => {
  load();
  fetchSafeInfo(SYC.CHAIN, SYC_MINT.ADMIN_SAFE)
    .then((info) => { adminSafe.value = info; })
    .catch((error) => console.error("Could not read the admin Safe", error));
});

const lastDistribution = computed(() => state.value?.plan.distributions.at(-1));
const metaText = computed(() => {
  if (!state.value) return "Admin multisig";
  const n = state.value.plan.distributions.length;
  return `${n === 0 ? "No mints yet" : n === 1 ? "1 mint so far" : `${n} mints so far`} · block ${state.value.head}`;
});
const newSinceText = computed(() => {
  const flows = state.value?.plan.flows;
  if (!flows) return "";
  const parts = [];
  if (flows.incentives.length) parts.push(`${flows.incentives.length} × 34,000 SNI incentive`);
  if (flows.yieldSni > 0n) parts.push(`${syc(flows.yieldSni)} SNI bought with yield`);
  return parts.length ? parts.join(", ") : "nothing";
});

/* -------------------------------------------------------------- propose */

const account = computed(() => accountStore.activeAccountAddress);
/** What the connected wallet is to the admin Safe. */
const standing = computed<"safe" | "owner" | "unknown" | "none">(() => {
  if (!account.value) return "none";
  if (same(account.value, SYC_MINT.ADMIN_SAFE)) return "safe";
  if (!adminSafe.value) return "unknown";
  return adminSafe.value.owners.some((o) => same(o, account.value)) ? "owner" : "none";
});
const quorum = computed(() => (adminSafe.value ? `${adminSafe.value.threshold} of ${adminSafe.value.owners.length}` : "the required"));
const proposeHint = computed(() => {
  switch (standing.value) {
    case "safe": return "Connected as the admin Safe: proposing opens it in Safe{Wallet} for your signature.";
    case "owner": return `You sign as an owner (no gas). ${quorum.value} owners must sign in Safe{Wallet} before it runs.`;
    case "unknown": return "Owner list not loaded: the Safe service refuses a proposal from a non-owner.";
    default: return `Connect an owner of the admin Safe ${shortAddress(SYC_MINT.ADMIN_SAFE)} to propose, or download the file for its Transaction Builder.`;
  }
});
const proposeDisabledReason = computed(() => {
  if (!state.value) return "Loading…";
  if (!state.value.check.ok) return "The dry run fails: see Needs attention.";
  if (state.value.spare < 0n) return "The Safe does not hold enough SNI to back this mint.";
  if (standing.value === "none") return account.value ? "The connected wallet is not an owner of the admin Safe" : "Connect an owner of the admin Safe";
  return "";
});

type Phase = "idle" | "checking" | "signing" | "filing";
const act = reactive({ phase: "idle" as Phase, error: "" });
const proposeText = computed(() => {
  if (act.phase === "checking") return "Checking…";
  if (act.phase === "signing") return "Sign in your wallet…";
  if (act.phase === "filing") return "Filing with the Safe…";
  return "Propose to the admin multisig";
});
const declined = (err: any) => {
  const message = err?.innerError?.message || err?.message || "";
  return err?.code === 4001 || err?.innerError?.code === 4001 || /user (denied|rejected)/i.test(message);
};

const propose = async () => {
  const provider = accountStore.connectedWallet?.provider as any;
  const signer = account.value;
  if (!state.value || !provider || !signer || act.phase !== "idle") return;
  act.error = "";
  try {
    // The amounts move with every incentive mint and swap: propose what is due now.
    act.phase = "checking";
    await load();
    const plan = state.value!.plan;
    if (plan.totalDue === 0n) return;
    if (queued.value) return;
    if (!state.value!.check.ok) throw new Error("The dry run fails now: see Needs attention.");
    const call = buildRoleCall(plan.amounts, plan.recipients);
    if (accountStore.connectedWalletChainId !== SYC.CHAIN) await accountStore.switchNetwork(SYC.CHAIN);

    act.phase = "signing";
    if (standing.value === "safe") {
      // Safe{Wallet} over WalletConnect turns a send from the Safe into a proposal.
      await provider.request({
        method: "eth_sendTransaction",
        params: [{ from: SYC_MINT.ADMIN_SAFE, to: call.to, data: call.data, value: "0x0" }],
      });
    } else {
      const safe = await fetchSafeInfo(SYC.CHAIN, SYC_MINT.ADMIN_SAFE);
      adminSafe.value = safe;
      const nonce = await fetchNextSafeNonce(SYC.CHAIN, SYC_MINT.ADMIN_SAFE, safe.nonce);
      const tx = buildSafeTx({ to: call.to, data: call.data, value: "0" }, nonce);
      const signature = await signSafeTx(provider, signer, SYC.CHAIN, SYC_MINT.ADMIN_SAFE, tx);
      act.phase = "filing";
      const safeTxHash = await proposeSafeTx(SYC.CHAIN, SYC_MINT.ADMIN_SAFE, tx, signer, signature, "rethink.finance SYC distribution");
      queued.value = { safeTxHash, nonce, confirmations: 1, required: safe.threshold };
    }
    toastStore.successToast(`Proposed: ${syc(plan.totalDue)} SYC to ${plan.recipients.length} wallets. The other owners sign and execute it in Safe{Wallet}.`);
    queued.value ??= await findQueuedProposal(call.data).catch(() => null);
  } catch (error: any) {
    console.error(error);
    if (!declined(error)) act.error = error?.message || "There has been an error.";
  } finally {
    act.phase = "idle";
  }
};

/* ------------------------------------------------------------- download */

const download = () => {
  if (!state.value) return;
  const date = new Date().toISOString().slice(0, 10);
  const file = transactionBuilderFile(state.value.plan, date);
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `syc-distribution-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
</script>

<style scoped lang="scss">
.mint {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.mint_head {
  margin-bottom: 0.25rem;
}

.mint_lead {
  font-size: 13px;
  line-height: 1.55;
  color: $color-steel-blue;

  code {
    font-family: $font-mono;
    font-size: 12px;
    color: $color-light-subtitle;
  }
}

.mint_due {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;

  &__value {
    font-family: $font-mono;
    font-size: 26px;
    font-weight: 500;
    color: $color-white;
    font-variant-numeric: tabular-nums;
    line-height: 1.15;
  }

  &__label {
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $color-steel-blue;
  }
}

.mint_table_wrap {
  overflow-x: auto;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
}

.mint_table {
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
}

.mint_facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
}

.mint_kv {
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
    color: $color-cyan !important;
  }
}

.mint_neg {
  color: $color-neg !important;
}

.mint_checks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
}

.mint_check {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-family: $font-mono;
  font-size: 12px;

  &--ok {
    color: $color-cyan;
  }

  &--bad {
    color: $color-neg;
  }
}

.mint_attention {
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  padding: 0.6rem 0.85rem;
  font-size: 12.5px;
  line-height: 1.5;
  color: $color-light-subtitle;

  &__title {
    font-family: $font-mono;
    font-size: 10.5px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: $color-steel-blue;
    margin-bottom: 0.35rem;
  }

  ul {
    margin: 0;
    padding-left: 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    overflow-wrap: anywhere;
  }
}

.mint_row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.mint_btn.v-btn {
  text-transform: none;
  letter-spacing: 0;
}

.mint_hint {
  font-family: $font-mono;
  font-size: 12px;
  line-height: 1.5;
  color: $color-steel-blue;
}

.mint_notice {
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

.mint_done {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
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
