<template>
  <div class="crt_console">
    <!--
      Headline balances, laid out as the vault overview's stat strip: the total
      carried at display size on the left, the seven places that money actually
      sits stepped down beside it. No card — it reads as page furniture.
    -->
    <div class="crt_summary">
      <div class="crt_summary__hero">
        <div class="crt_label crt_label--accent">
          Current NAV
        </div>
        <div class="crt_summary__value_row">
          <span class="crt_summary__figure">{{ totalNav }}</span>
          <span class="crt_summary__unit">USDC</span>
        </div>
      </div>

      <div class="crt_summary__divider" />

      <div class="crt_summary__breakdown">
        <div v-for="s in statItems" :key="s.label" class="crt_stat">
          <div class="crt_label">
            {{ s.label }}
          </div>
          <div class="crt_stat__value">
            {{ s.value }}
          </div>
        </div>
      </div>

      <v-btn
        class="crt_summary__refresh"
        variant="outlined"
        size="small"
        :loading="loadingBal"
        @click="refresh"
      >
        Refresh
      </v-btn>
    </div>

    <div class="crt_layout">
      <div class="crt_main">
        <div class="group_title crt_section">
          Move capital
        </div>

        <div class="brand_card crt_card">
          <div class="crt_card__head">
            <div class="crt_card__titles">
              <div class="brand_card__eyebrow">
                EVM &#8596; HyperCore bridge
              </div>
              <div class="crt_card__sub">
                {{ bridgeDir === "toCore"
                  ? "approve → depositFor · receiver pinned to the Safe · credits perp margin"
                  : "sendAsset from Core spot to the Safe's EVM balance · fixed amounts only" }}
              </div>
            </div>
          </div>
          <div class="crt_row">
            <v-select
              v-model="bridgeDir"
              :items="[{ title: 'EVM → Core', value: 'toCore' }, { title: 'Core → EVM', value: 'toEvm' }]"
              density="compact"
              hide-details
              class="crt_field--narrow"
            />
            <v-text-field
              v-if="bridgeDir === 'toCore'"
              v-model="bridgeAmt"
              placeholder="Amount"
              suffix="USDC"
              density="compact"
              hide-details
            />
            <v-select
              v-else
              v-model="bridgeFixed"
              :items="fixedItems"
              density="compact"
              hide-details
            />
            <v-btn
              variant="outlined"
              :disabled="bridgeDir === 'toCore' && !validAmt(bridgeAmt)"
              @click="stageBridge"
            >
              Review
            </v-btn>
          </div>
        </div>

        <div class="brand_card crt_card">
          <div class="crt_card__head">
            <div class="crt_card__titles">
              <div class="brand_card__eyebrow">
                Spot &#8596; perp (usdClassTransfer)
              </div>
              <div class="crt_card__sub">
                Whitelist is exact-match: fixed amounts only
              </div>
            </div>
          </div>
          <div class="crt_row">
            <v-select
              v-model="ctDir"
              :items="[{ title: 'Spot → perp', value: 'toPerp' }, { title: 'Perp → spot', value: 'toSpot' }]"
              density="compact"
              hide-details
              class="crt_field--narrow"
            />
            <v-select
              v-model="ctAmt"
              :items="fixedItems"
              density="compact"
              hide-details
            />
            <v-select
              v-model="ctReps"
              :items="['1', '2', '3', '4', '5'].map(v => ({ title: '×' + v, value: v }))"
              density="compact"
              hide-details
              class="crt_field--tiny"
            />
            <v-btn variant="outlined" @click="stageClassTransfer">
              Review
            </v-btn>
          </div>
        </div>

        <div class="group_title crt_section">
          Payout
          <span class="crt_tag crt_tag--danger">Role 2 · payout safe 2-of-4</span>
        </div>

        <div class="brand_card crt_card crt_card--payout">
          <div class="crt_stat">
            <div class="crt_label">
              Destination · pinned
            </div>
            <div class="crt_stat__value">
              {{ shortAddr(CRT.ADDR.payoutEOA) }}
            </div>
            <div class="crt_card__sub">
              Payout EOA. Every other address reverts
            </div>
          </div>
          <div class="crt_row">
            <v-text-field
              v-model="payoutAmt"
              placeholder="Amount"
              suffix="USDC"
              density="compact"
              hide-details
            />
            <v-btn
              variant="outlined"
              :disabled="!validAmt(payoutAmt)"
              @click="stagePayout"
            >
              Review
            </v-btn>
          </div>
        </div>

        <div class="group_title crt_section">
          Yield venues
        </div>

        <div class="crt_grid2">
          <div class="brand_card crt_card">
            <div class="crt_card__head">
              <div class="crt_card__titles">
                <div class="brand_card__eyebrow">
                  Felix
                </div>
              </div>
              <div class="crt_stat crt_stat--right">
                <div class="crt_label">
                  Position
                </div>
                <div class="crt_stat__value">
                  {{ bal ? fmt6(bal.felixAssets) + " USDC" : "—" }}
                </div>
                <div v-if="bal" class="crt_card__sub">
                  {{ Number(formatUnits(bal.felixShares, 18)).toFixed(4) }} {{ bal.felixSymbol }}
                </div>
              </div>
            </div>
            <div class="crt_row">
              <v-text-field
                v-model="felixDep"
                placeholder="Deposit"
                suffix="USDC"
                density="compact"
                hide-details
              />
              <v-btn
                variant="outlined"
                :disabled="!validAmt(felixDep, CRT.APPROVE_CAP)"
                @click="stageFelixDeposit"
              >
                Review
              </v-btn>
            </div>
            <div class="crt_row">
              <v-text-field
                v-model="felixWd"
                placeholder="Withdraw"
                suffix="USDC"
                density="compact"
                hide-details
              />
              <v-btn
                variant="outlined"
                :disabled="!validAmt(felixWd)"
                @click="stageFelixWithdraw"
              >
                Review
              </v-btn>
            </div>
            <div class="crt_card__foot">
              <v-btn
                variant="text"
                size="small"
                class="crt_text_action"
                @click="stageFelixRedeemAll"
              >
                Redeem all
              </v-btn>
            </div>
          </div>

          <div class="brand_card crt_card">
            <div class="crt_card__head">
              <div class="crt_card__titles">
                <div class="brand_card__eyebrow">
                  HyperLend
                </div>
              </div>
              <div class="crt_stat crt_stat--right">
                <div class="crt_label">
                  Position
                </div>
                <div class="crt_stat__value">
                  {{ bal ? fmt6(bal.hlend) + " USDC" : "—" }}
                </div>
                <div v-if="bal" class="crt_card__sub">
                  {{ Number(formatUnits(bal.hlend, 6)).toFixed(4) }} hUSDC
                </div>
              </div>
            </div>
            <div class="crt_row">
              <v-text-field
                v-model="hlSup"
                placeholder="Supply"
                suffix="USDC"
                density="compact"
                hide-details
              />
              <v-btn
                variant="outlined"
                :disabled="!validAmt(hlSup, CRT.APPROVE_CAP)"
                @click="stageHlSupply"
              >
                Review
              </v-btn>
            </div>
            <div class="crt_row">
              <v-text-field
                v-model="hlWd"
                placeholder="Withdraw"
                suffix="USDC"
                density="compact"
                hide-details
              />
              <v-btn
                variant="outlined"
                :disabled="!validAmt(hlWd)"
                @click="stageHlWithdraw(false)"
              >
                Review
              </v-btn>
            </div>
            <div class="crt_card__foot">
              <v-btn
                variant="text"
                size="small"
                class="crt_text_action"
                @click="stageHlWithdraw(true)"
              >
                Withdraw all
              </v-btn>
            </div>
          </div>
        </div>

        <div class="group_title crt_section">
          Agents
        </div>

        <div class="brand_card crt_card">
          <div v-for="a in CRT.AGENTS" :key="a.addr" class="crt_agent">
            <div class="crt_agent__body">
              <div class="crt_agent__name">
                {{ a.label }}
                <span v-if="a.kind === 'backup'" class="crt_tag crt_tag--danger">Break-glass</span>
              </div>
              <div class="crt_card__sub">
                <span class="crt_mono">{{ shortAddr(a.addr) }}</span> · {{ a.desc }}
              </div>
            </div>
            <div class="crt_agent__status">
              <span class="crt_dot" :class="`crt_dot--${agentState(a.addr).tone}`" />
              {{ agentState(a.addr).text }}
            </div>
            <div class="crt_agent__actions">
              <template v-if="a.kind === 'backup'">
                <input
                  v-model="backupArm"
                  placeholder="type DEREGISTER"
                  class="crt_arm_input"
                >
                <v-btn
                  variant="outlined"
                  size="small"
                  :disabled="backupArm.trim().toUpperCase() !== 'DEREGISTER'"
                  @click="stageAgent(a)"
                >
                  Register
                </v-btn>
              </template>
            </div>
          </div>
        </div>
      </div>

      <aside class="crt_aside">
        <!-- Carries the same section caption the left column does, so the panel
             below starts level with the first card over there. -->
        <div class="group_title crt_section">
          Simulate &amp; sign
        </div>

        <div v-if="!staged" class="brand_card crt_panel crt_panel--empty">
          <p class="crt_panel__intro">
            Pick an action on the left. Every call is assembled programmatically,
            wrapped for the Roles modifier, simulated from the whitelisted sender,
            and only then handed to the wallet. No copy-pasting hex.
          </p>
        </div>

        <div v-else class="brand_card crt_panel">
          <div class="crt_panel__head">
            <div class="crt_panel__titles">
              <div class="crt_panel__title">
                {{ staged.title }}
              </div>
            </div>
            <button
              class="crt_panel__close"
              aria-label="Discard staged action"
              @click="staged = null"
            >
              <Icon icon="material-symbols:close" width="1.125rem" height="1.125rem" />
            </button>
          </div>

          <div v-for="wtext in staged.warns || []" :key="wtext" class="crt_warn">
            {{ wtext }}
          </div>

          <label v-if="staged.confirmPhrase" class="crt_confirm">
            <input v-model="confirmed" type="checkbox">
            <span>I understand: {{ staged.confirmPhrase }}</span>
          </label>

          <div
            class="crt_steps"
            :class="{ 'crt_steps--gated': staged.confirmPhrase && !confirmed }"
          >
            <div v-for="(step, i) in staged.steps" :key="i" class="crt_step">
              <div class="crt_step__head">
                <b>{{ step.label }}</b>
                <span class="crt_mono_dim">{{ step.wrapped.inner.sig }}</span>
              </div>
              <div v-for="p in step.wrapped.inner.params" :key="p.k" class="crt_param">
                <span>{{ p.k }}</span>
                <span>{{ p.v }}<em v-if="p.pinned" class="crt_pinned"> · pinned</em></span>
              </div>
              <div class="crt_mono_dim">
                to Roles {{ shortAddr(CRT.ADDR.roles) }} ·
                execTransactionWithRole(role {{ staged.role }})
                {{ crtValidateWrapped(step.wrapped.data) ? "· 0x6928e74b ✓" : "· BAD PREFIX" }}
              </div>
              <div class="crt_hex">
                {{ step.wrapped.data }}
              </div>
              <div
                v-if="step.sim"
                class="crt_sim"
                :class="step.sim === 'pending'
                  ? ''
                  : step.sim.ok
                    ? 'crt_sim--ok'
                    : step.sim.soft && step.expectSoftFail
                      ? 'crt_sim--soft'
                      : 'crt_sim--bad'"
              >
                <template v-if="step.sim === 'pending'">
                  simulating from the whitelisted sender…
                </template>
                <template v-else-if="step.sim.ok">
                  ✓ simulation passed
                </template>
                <template v-else>
                  ✗ {{ step.sim.name }}
                  <div class="crt_sim__hint">
                    {{ step.sim.soft && step.expectSoftFail
                      ? "Expected before the approve step is mined. Not a permission failure."
                      : step.sim.hint }}
                  </div>
                </template>
              </div>
              <div class="crt_step__actions">
                <span v-if="step.txStatus === 'pending'" class="crt_mono_dim">
                  pending {{ shortAddr(step.txHash) }}…
                </span>
                <a
                  v-if="step.txStatus === 'ok'"
                  :href="CRT.EXPLORER + '/tx/' + step.txHash"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="crt_ok"
                >
                  ✓ mined · view
                </a>
                <span v-if="step.txStatus === 'fail'" class="crt_bad">✗ reverted on-chain</span>
                <v-btn
                  variant="text"
                  size="small"
                  class="crt_text_action"
                  @click="simulateStep(step)"
                >
                  Re-simulate
                </v-btn>
                <v-btn
                  v-if="staged.role === 1"
                  class="bg-primary text-secondary"
                  size="small"
                  :disabled="!isManager || step.txStatus === 'pending' || step.txStatus === 'ok'"
                  :title="isManager ? '' : 'Connect the manager EOA'"
                  @click="exec(step)"
                >
                  {{ step.txStatus === "ok" ? "Executed" : "Execute" }}
                </v-btn>
                <v-btn
                  v-else
                  variant="outlined"
                  size="small"
                  @click="copyText(step.wrapped.data)"
                >
                  Copy for Safe
                </v-btn>
              </div>
            </div>
          </div>

          <div v-if="staged.steps.length > 1" class="crt_panel__note">
            Step 2 always fails simulation until step 1 is mined; the pre-flight ✗
            on it is expected, not an error.
          </div>
        </div>

        <p class="crt_footnote">
          Every transaction goes to the Roles modifier {{ shortAddr(CRT.ADDR.roles) }}
          as execTransactionWithRole: value 0, operation Call, shouldRevert true.
          Nothing here can reach an arbitrary address.
        </p>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ethers } from "ethers";
import { DEFAULT_RETURN_FORMAT } from "web3";
import { useFundStore } from "~/store/fund/fund.store";
import { useToastStore } from "~/store/toasts/toast.store";
import { useAccountStore } from "~/store/account/account.store";
import { CRT, crtInner, crtWrap, crtValidateWrapped, crtSimulate, crtGetBalances, crtGetCore, crtAgentStatus, fmt6, shortAddr } from "~/composables/execution/crtConsole";

const fundStore = useFundStore();
const toastStore = useToastStore();
const accountStore = useAccountStore();
const formatUnits = ethers.formatUnits;

const bal = ref<any>(null);
const core = ref<any>(null);
const loadingBal = ref(false);
const staged = ref<any>(null);
const confirmed = ref(false);
const agentsStatus = reactive<Record<string, any>>({});

const bridgeDir = ref("toCore"); const bridgeAmt = ref("1"); const bridgeFixed = ref("1");
const ctDir = ref("toPerp"); const ctAmt = ref("1"); const ctReps = ref("1");
const payoutAmt = ref(""); const felixDep = ref(""); const felixWd = ref("");
const hlSup = ref(""); const hlWd = ref(""); const backupArm = ref("");

const fixedItems = CRT.AMOUNTS.map((v) => ({ title: v.toLocaleString("en-US") + " USDC", value: String(v) }));
const validAmt = (v: string, cap?: number) => { const x = Number(v); return v !== "" && isFinite(x) && x > 0 && (cap == null || x <= cap); };
const isManager = computed(() => (fundStore.activeAccountAddress || "").toLowerCase() === CRT.ADDR.manager.toLowerCase());
const n2 = (x: number) => x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statItems = computed(() => [
  { label: "Safe · EVM USDC", value: bal.value ? fmt6(bal.value.safeUsdc) : "—" },
  { label: "Fund contract", value: bal.value ? fmt6(bal.value.fundUsdc) : "—" },
  { label: "Core spot", value: core.value ? n2(core.value.spotUsdc) : "—" },
  { label: "Core perp", value: core.value ? n2(core.value.perpValue) : "—" },
  { label: "Payout", value: bal.value ? fmt6(bal.value.payoutUsdc) : "—" },
  { label: "Felix", value: bal.value ? fmt6(bal.value.felixAssets) : "—" },
  { label: "HyperLend", value: bal.value ? fmt6(bal.value.hlend) : "—" },
]);
// The unit is rendered beside the figure, so this is the number alone.
const totalNav = computed(() => {
  if (!bal.value || !core.value) return "—";
  const evm = Number(ethers.formatUnits(bal.value.safeUsdc + bal.value.felixAssets + bal.value.hlend + bal.value.fundUsdc, 6));
  return n2(evm + core.value.spotUsdc + core.value.perpValue);
});

const refresh = async () => {
  loadingBal.value = true;
  await Promise.all([
    crtGetBalances().then((b) => (bal.value = b)).catch(() => {}),
    crtGetCore().then((c) => (core.value = c)).catch(() => {}),
  ]);
  loadingBal.value = false;
};
onMounted(() => {
  refresh();
  CRT.AGENTS.forEach(async (a) => { agentsStatus[a.addr.toLowerCase()] = await crtAgentStatus(a.addr); });
});

/**
 * Registration status as a tone plus its wording, so the row can carry a
 * coloured dot the way the rest of the app marks state rather than a bullet
 * baked into the string.
 */
const agentState = (addr: string): { tone: string; text: string } => {
  const s = agentsStatus[addr.toLowerCase()];
  if (!s) return { tone: "idle", text: "checking…" };
  if (s.error) return { tone: "idle", text: "unknown" };
  if (s.live && s.ours) return { tone: "on", text: "live · agent of Safe" };
  if (s.live) return { tone: "warn", text: "agent of another user" };
  return { tone: "off", text: "not registered" };
};

const simulateStep = async (step: any) => {
  step.sim = "pending";
  step.sim = await crtSimulate(step.wrapped, staged.value.role === 1 ? CRT.ADDR.manager : CRT.ADDR.payoutSafe);
};
const stage = (action: any) => {
  confirmed.value = false;
  action.steps = action.steps.map((s: any) => reactive({ ...s, sim: null, txStatus: null, txHash: null }));
  staged.value = action;
  action.steps.forEach((s: any) => simulateStep(s));
};

const stageBridge = () => bridgeDir.value === "toCore"
  ? stage({
    title: `EVM → Core: deposit ${bridgeAmt.value} USDC`, role: 1,
    warns: Number(bridgeAmt.value) > 1 ? ["Only a 1 USDC deposit has succeeded live; 2/5/10+ reverted in testing. Amounts above 1 are unproven."] : [],
    steps: [
      { label: "1 · Approve CoreDepositWallet", wrapped: crtWrap(crtInner.approve(CRT.ADDR.cdw, "CoreDepositWallet", bridgeAmt.value), 1) },
      { label: "2 · depositFor(Safe)", wrapped: crtWrap(crtInner.cdwDepositFor(bridgeAmt.value), 1), expectSoftFail: true },
    ],
  })
  : stage({ title: `Core → EVM: send ${Number(bridgeFixed.value).toLocaleString("en-US")} USDC`, role: 1, steps: [{ label: "sendAsset (credits the Safe on HyperEVM)", wrapped: crtWrap(crtInner.sendAssetToEvm(Number(bridgeFixed.value)), 1) }] });

const stageClassTransfer = () => {
  const nReps = Number(ctReps.value); const v = Number(ctAmt.value); const toPerp = ctDir.value === "toPerp";
  stage({
    title: `Core: move ${(v * nReps).toLocaleString("en-US")} USDC ${toPerp ? "spot → perp" : "perp → spot"}`, role: 1,
    warns: nReps > 1 ? [`No ${(v * nReps).toLocaleString("en-US")}-rung exists, so this queues the ${v.toLocaleString("en-US")} USDC rung ${nReps} times.`] : [],
    steps: Array.from({ length: nReps }, (_, i) => ({ label: (nReps > 1 ? `${i + 1} · ` : "") + `usdClassTransfer ${v.toLocaleString("en-US")} USDC ${toPerp ? "→ perp" : "→ spot"}`, wrapped: crtWrap(crtInner.usdClassTransfer(v, toPerp), 1) })),
  });
};
const stagePayout = () => stage({
  title: `Payout ${payoutAmt.value} USDC`, role: 2,
  confirmPhrase: `${Number(payoutAmt.value).toLocaleString("en-US", { maximumFractionDigits: 6 })} USDC leaves the Safe to the payout EOA. Nothing on-chain bounds this amount.`,
  steps: [{ label: "USDC.transfer(payout EOA)", wrapped: crtWrap(crtInner.payout(payoutAmt.value), 2) }],
});
const stageFelixDeposit = () => stage({
  title: `Felix: deposit ${felixDep.value} USDC`, role: 1,
  steps: [
    { label: "1 · Approve Felix vault", wrapped: crtWrap(crtInner.approve(CRT.ADDR.felix, "Felix vault", felixDep.value), 1) },
    { label: "2 · Deposit", wrapped: crtWrap(crtInner.felixDeposit(felixDep.value), 1), expectSoftFail: true },
  ],
});
const stageFelixWithdraw = () => stage({ title: `Felix: withdraw ${felixWd.value} USDC`, role: 1, steps: [{ label: "Withdraw (exact USDC out)", wrapped: crtWrap(crtInner.felixWithdraw(felixWd.value), 1) }] });
const stageFelixRedeemAll = () => stage({
  title: "Felix: redeem all shares", role: 1,
  warns: !bal.value || bal.value.felixShares === 0n ? ["No Felix shares held, so this will revert."] : [],
  steps: [{ label: "Redeem full share balance", wrapped: crtWrap(crtInner.felixRedeem(bal.value ? bal.value.felixShares : 0n), 1) }],
});
const stageHlSupply = () => stage({
  title: `HyperLend: supply ${hlSup.value} USDC`, role: 1,
  steps: [
    { label: "1 · Approve HyperLend pool", wrapped: crtWrap(crtInner.approve(CRT.ADDR.pool, "HyperLend pool", hlSup.value), 1) },
    { label: "2 · Supply", wrapped: crtWrap(crtInner.poolSupply(hlSup.value), 1), expectSoftFail: true },
  ],
});
const stageHlWithdraw = (max: boolean) => {
  if (!max && !validAmt(hlWd.value)) return;
  stage({ title: max ? "HyperLend: withdraw all" : `HyperLend: withdraw ${hlWd.value} USDC`, role: 1, steps: [{ label: max ? "Withdraw full position + interest" : "Withdraw", wrapped: crtWrap(crtInner.poolWithdraw(max ? "max" : hlWd.value), 1) }] });
};
const stageAgent = (a: any) => stage({
  title: `Register ${a.label.toLowerCase()}`, role: 1,
  warns: ["BREAK-GLASS: this deregisters the primary agent. Deregistered addresses can never be reused."],
  steps: [{ label: "addApiWallet payload (exact-match)", wrapped: crtWrap(crtInner.addApiWallet(a.addr, a.name), 1) }],
});

const copyText = (t: string) => { navigator.clipboard.writeText(t); toastStore.addToast("Calldata copied. Propose it in the payout Safe."); };

const exec = async (step: any) => {
  if (!accountStore.connectedWalletWeb3) { toastStore.errorToast("Connect your wallet."); return; }
  try {
    step.txStatus = "pending";
    await accountStore.connectedWalletWeb3.eth
      .sendTransaction(
        { to: step.wrapped.to, data: step.wrapped.data, from: fundStore.activeAccountAddress, maxFeePerGas: "", value: 0 },
        DEFAULT_RETURN_FORMAT,
        { checkRevertBeforeSending: false },
      )
      .on("transactionHash", (hash: any) => { step.txHash = hash; toastStore.addToast("The transaction has been submitted. Please wait for it to be confirmed."); })
      .on("receipt", (receipt: any) => {
        step.txStatus = receipt.status ? "ok" : "fail";
        if (receipt.status) { toastStore.successToast("The transaction was successful."); refresh(); }
        else toastStore.errorToast("The transaction has failed.");
      })
      .on("error", (error: any) => { console.error(error); step.txStatus = null; toastStore.errorToast("There has been an error."); });
  } catch (error) { console.error(error); step.txStatus = null; }
};
</script>

<style scoped lang="scss">
.crt_console {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  margin-bottom: 2.5rem;
}

/* The mono uppercase caption the whole design system labels figures with. */
.crt_label {
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

.crt_mono {
  font-family: $font-mono;
}

/**
 * Headline balances. Same construction as the vault overview's stat strip —
 * hero figure keeping the left edge, hairline divider pushing the derived
 * numbers away from it, no card behind any of it.
 */
.crt_summary {
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

  /* Seven balances plus the total only fit on one line on a wide desktop;
     below that the divider would be left hanging at the end of the row. */
  &__divider {
    display: none;
    width: 1px;
    align-self: stretch;
    background: $color-line;

    /* 1360px is where the total and all seven balances measurably share a
       line with room to spare; .crt_layout below is keyed off the viewport
       the same way. */
    @media (min-width: 1360px) {
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

.crt_stat {
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
  }
}

/**
 * Group heading. Type comes from the global .group_title — the same 16px
 * title the governance activity card carries; this only adds the space a
 * heading needs above the cards it introduces.
 */
.crt_section {
  margin-top: 0.75rem;

  &:first-child {
    margin-top: 0;
  }
}

.crt_tag {
  font-family: $font-mono;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  padding: 0.1875rem 0.4375rem;
  border-radius: 3px;

  &--danger {
    color: $color-neg;
    background: $color-neg-soft;
    border: 1px solid $color-neg-line;
  }
}

/* .brand_card supplies the chrome; this is only the internal rhythm. */
.crt_card {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;

  &--payout {
    border-color: $color-neg-line;
  }

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

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
  }

  /* The "do the whole position" escape hatch, kept out of the amount row so
     the field it sits beside does not get squeezed to seven characters. */
  &__foot {
    display: flex;
    justify-content: flex-end;
    margin-top: -0.375rem;
  }
}

.crt_layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 400px;
  gap: 1.75rem;
  align-items: start;

  @media (max-width: 1180px) {
    grid-template-columns: 1fr;
  }
}

.crt_main {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

.crt_row {
  display: flex;
  gap: 0.625rem;
  align-items: center;
  flex-wrap: wrap;

  > * {
    flex: 1;
    min-width: 120px;
  }

  > .v-btn {
    flex: 0 0 auto;
    min-width: 0;
  }
}

.crt_field {
  &--narrow {
    max-width: 180px;
  }

  &--tiny {
    max-width: 110px;
  }
}

.crt_grid2 {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 1rem;
}

/**
 * A text action reads as a link, the way "Execute performance fee (HWM)" does
 * on the design's Execution App screen. !important because the md2 blueprint
 * gives every v-btn color="primary", and Vuetify's text-primary utility class
 * carries !important of its own.
 */
.crt_text_action.v-btn {
  color: $color-cyan !important;
  font-weight: 600;
}

.crt_agent {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) auto auto;
  gap: 0.875rem;
  align-items: center;
  padding: 0.875rem 0;
  border-top: 1px solid $color-line;

  &:first-of-type {
    border-top: 0;
    padding-top: 0;
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
  }

  &__name {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 13.5px;
    font-weight: 600;
    color: $color-white;
  }

  &__status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-family: $font-mono;
    font-size: 11.5px;
    letter-spacing: 0.04em;
    color: $color-steel-blue;
    white-space: nowrap;
  }

  &__actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
}

/* State marker, same 7px disc the Zodiac pill uses. */
.crt_dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  flex: none;
  background: $color-steel-blue;

  &--on {
    background: $color-pos;
  }

  &--warn {
    background: $color-warning;
  }

  &--off {
    background: $color-inactive;
  }
}

.crt_aside {
  position: sticky;
  top: 1rem;
  display: flex;
  flex-direction: column;
  /* Same rhythm as .crt_main, so the section caption puts this column's first
     card on exactly the baseline the left column's first card sits on. */
  gap: 1rem;
}

.crt_panel {
  /**
   * Squared off against the bridge card opposite it — brand_card padding, an
   * eyebrow, a line of description and a control row measure 151px there, and
   * the two are read as a pair. In px because the two cards have no shared
   * unit to derive it from. Only a floor: a staged action grows past it.
   */
  &--empty {
    min-height: 151px;
    /* Centred rather than top-set: the slack the min-height creates should
       read as deliberate, not as a card that ran out of content. */
    display: grid;
    align-content: center;
  }

  &__intro {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: $color-light-subtitle;
  }

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.625rem;
  }

  &__titles {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 0;
  }

  &__title {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.35;
    color: $color-white;
  }

  /* Matches the dialog close control: a 32px hit area that lights up, not a
     bare glyph. */
  &__close {
    display: grid;
    place-items: center;
    flex: none;
    width: 2rem;
    height: 2rem;
    margin: -0.375rem -0.5rem 0 0;
    border-radius: $default-border-radius;
    color: $color-steel-blue;
    cursor: pointer;
    transition: background-color $default-transition-time ease,
      color $default-transition-time ease;

    &:hover {
      background: $color-gray-light-transparent;
      color: $color-white;
    }
  }

  &__note {
    margin-top: 0.625rem;
    font-size: 12px;
    line-height: 1.5;
    color: $color-steel-blue;
  }
}

.crt_warn {
  margin-top: 0.875rem;
  border: 1px solid $color-neg-line;
  background: $color-neg-soft;
  border-radius: $default-border-radius;
  padding: 0.5625rem 0.75rem;
  font-size: 12.5px;
  line-height: 1.5;
  color: $color-neg;
}

.crt_confirm {
  display: flex;
  gap: 0.625rem;
  align-items: flex-start;
  margin-top: 0.875rem;
  font-size: 12.5px;
  line-height: 1.5;
  color: $color-light-subtitle;
  cursor: pointer;

  input {
    /* The global input rule sizes text fields; a checkbox needs none of it. */
    min-height: 0;
    height: auto;
    padding: 0;
    margin-top: 2px;
    accent-color: $color-cyan;
  }
}

.crt_steps {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;

  &--gated {
    opacity: 0.35;
    pointer-events: none;
  }
}

.crt_step {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  border: 1px solid $color-line;
  border-radius: $default-border-radius;
  background: $color-card-background;
  padding: 0.875rem;
  margin-top: 0.625rem;

  &__head {
    display: flex;
    justify-content: space-between;
    gap: 0.625rem;
    align-items: baseline;
    font-size: 13px;
  }

  &__actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    align-items: center;
    flex-wrap: wrap;
  }
}

.crt_mono_dim {
  font-family: $font-mono;
  font-size: 11px;
  color: $color-steel-blue;
  word-break: break-all;
}

.crt_pinned {
  font-style: normal;
  color: $color-text-irrelevant;
  font-size: 10.5px;
}

.crt_param {
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

.crt_hex {
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

.crt_sim {
  border-radius: $default-border-radius;
  padding: 0.5rem 0.6875rem;
  font-family: $font-mono;
  font-size: 12px;
  line-height: 1.5;
  border: 1px solid $color-line;
  color: $color-steel-blue;

  /* Cyan, not green: in this palette an affirmative reading is the accent. */
  &--ok {
    color: $color-cyan;
    border-color: $color-cyan-line;
    background: $color-cyan-tint;
  }

  &--bad {
    color: $color-neg;
    border-color: $color-neg-line;
    background: $color-neg-soft;
  }

  &--soft {
    color: $color-light-subtitle;
  }

  &__hint {
    font-family: inherit;
    font-size: 11.5px;
    opacity: 0.85;
  }
}

/* Break-glass field: red text on the design's inset input, not a bare box. */
.crt_arm_input {
  width: 150px;
  min-height: 0;
  height: auto;
  background: $color-card-background;
  border: 1px solid $color-line-2;
  border-radius: $default-border-radius;
  color: $color-neg;
  font-family: $font-mono;
  font-size: 11.5px;
  padding: 0.5rem 0.625rem;
  outline: none;
  transition: border-color $default-transition-time ease;

  &::placeholder {
    color: $color-steel-blue;
  }

  &:focus {
    border-color: $color-line-3;
  }
}

.crt_ok {
  color: $color-cyan;
  font-family: $font-mono;
  font-size: 12px;

  &:hover {
    color: $color-cyan;
    text-decoration: underline;
  }
}

.crt_bad {
  color: $color-neg;
  font-family: $font-mono;
  font-size: 12px;
}

.crt_footnote {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: $color-steel-blue;
}
</style>
