<template>
  <div class="crt_console">
    <div class="crt_card crt_status">
      <div v-for="s in statItems" :key="s.label" class="crt_stat">
        <div class="crt_stat__label">{{ s.label }}</div>
        <div class="crt_stat__value">{{ s.value }}</div>
      </div>
      <div class="crt_status__right">
        <div class="crt_stat crt_stat--right">
          <div class="crt_stat__label">Total NAV</div>
          <div class="crt_stat__value">{{ totalNav }}</div>
        </div>
        <v-btn color="primary" variant="outlined" size="small" :loading="loadingBal" @click="refresh">Refresh</v-btn>
      </div>
    </div>

    <div class="crt_layout">
      <div class="crt_main">
        <h2 class="crt_h2">Move capital</h2>
        <div class="crt_card">
          <div class="crt_card__title">EVM &#8596; HyperCore bridge</div>
          <div class="crt_card__sub">{{ bridgeDir === "toCore" ? "approve → depositFor · receiver pinned to the Safe · credits perp margin" : "sendAsset from Core spot to the Safe's EVM balance · fixed amounts only" }}</div>
          <div class="crt_row">
            <v-select v-model="bridgeDir" :items="[{ title: 'EVM → Core', value: 'toCore' }, { title: 'Core → EVM', value: 'toEvm' }]" density="compact" hide-details style="max-width: 180px" />
            <v-text-field v-if="bridgeDir === 'toCore'" v-model="bridgeAmt" placeholder="Amount" suffix="USDC" density="compact" hide-details />
            <v-select v-else v-model="bridgeFixed" :items="fixedItems" density="compact" hide-details />
            <v-btn color="primary" variant="outlined" :disabled="bridgeDir === 'toCore' && !validAmt(bridgeAmt)" @click="stageBridge">Review</v-btn>
          </div>
        </div>
        <div class="crt_card">
          <div class="crt_card__title">Spot &#8596; perp (usdClassTransfer)</div>
          <div class="crt_card__sub">Whitelist is exact-match: fixed amounts only</div>
          <div class="crt_row">
            <v-select v-model="ctDir" :items="[{ title: 'Spot → perp', value: 'toPerp' }, { title: 'Perp → spot', value: 'toSpot' }]" density="compact" hide-details style="max-width: 180px" />
            <v-select v-model="ctAmt" :items="fixedItems" density="compact" hide-details />
            <v-select v-model="ctReps" :items="['1', '2', '3', '4', '5'].map(v => ({ title: '×' + v, value: v }))" density="compact" hide-details style="max-width: 110px" />
            <v-btn color="primary" variant="outlined" @click="stageClassTransfer">Review</v-btn>
          </div>
        </div>

        <h2 class="crt_h2">Payout <span class="crt_role2_tag">ROLE 2 · PAYOUT SAFE 2-OF-4</span></h2>
        <div class="crt_card crt_card--payout">
          <div class="crt_stat" style="margin-bottom: 14px">
            <div class="crt_stat__label">Destination · pinned</div>
            <div class="crt_stat__value">{{ shortAddr(CRT.ADDR.payoutEOA) }}</div>
            <div class="crt_stat__sub">Payout EOA. Every other address reverts</div>
          </div>
          <div class="crt_row">
            <v-text-field v-model="payoutAmt" placeholder="Amount" suffix="USDC" density="compact" hide-details />
            <v-btn color="primary" variant="outlined" :disabled="!validAmt(payoutAmt)" @click="stagePayout">Review</v-btn>
          </div>
        </div>

        <h2 class="crt_h2">Yield venues</h2>
        <div class="crt_grid2">
          <div class="crt_card">
            <div class="crt_card__head">
              <div class="crt_card__title">Felix</div>
              <div class="crt_stat crt_stat--right">
                <div class="crt_stat__label">Position</div>
                <div class="crt_stat__value">{{ bal ? fmt6(bal.felixAssets) + " USDC" : "—" }}</div>
                <div v-if="bal" class="crt_stat__sub">{{ Number(formatUnits(bal.felixShares, 18)).toFixed(4) }} {{ bal.felixSymbol }}</div>
              </div>
            </div>
            <div class="crt_row"><v-text-field v-model="felixDep" placeholder="Deposit" suffix="USDC" density="compact" hide-details /><v-btn color="primary" variant="outlined" :disabled="!validAmt(felixDep, CRT.APPROVE_CAP)" @click="stageFelixDeposit">Review</v-btn></div>
            <div class="crt_row"><v-text-field v-model="felixWd" placeholder="Withdraw" suffix="USDC" density="compact" hide-details /><v-btn color="primary" variant="outlined" :disabled="!validAmt(felixWd)" @click="stageFelixWithdraw">Review</v-btn><v-btn variant="text" color="primary" @click="stageFelixRedeemAll">Redeem all</v-btn></div>
          </div>
          <div class="crt_card">
            <div class="crt_card__head">
              <div class="crt_card__title">HyperLend</div>
              <div class="crt_stat crt_stat--right">
                <div class="crt_stat__label">Position</div>
                <div class="crt_stat__value">{{ bal ? fmt6(bal.hlend) + " USDC" : "—" }}</div>
                <div v-if="bal" class="crt_stat__sub">{{ Number(formatUnits(bal.hlend, 6)).toFixed(4) }} hUSDC</div>
              </div>
            </div>
            <div class="crt_row"><v-text-field v-model="hlSup" placeholder="Supply" suffix="USDC" density="compact" hide-details /><v-btn color="primary" variant="outlined" :disabled="!validAmt(hlSup, CRT.APPROVE_CAP)" @click="stageHlSupply">Review</v-btn></div>
            <div class="crt_row"><v-text-field v-model="hlWd" placeholder="Withdraw" suffix="USDC" density="compact" hide-details /><v-btn color="primary" variant="outlined" :disabled="!validAmt(hlWd)" @click="stageHlWithdraw(false)">Review</v-btn><v-btn variant="text" color="primary" @click="stageHlWithdraw(true)">Withdraw all</v-btn></div>
          </div>
        </div>

        <h2 class="crt_h2">Agents</h2>
        <div class="crt_card">
          <div v-for="a in CRT.AGENTS" :key="a.addr" class="crt_agent">
            <div>
              <div class="crt_agent__name">{{ a.label }} <span v-if="a.kind === 'backup'" class="crt_danger_tag">BREAK-GLASS</span></div>
              <div class="crt_stat__sub">{{ shortAddr(a.addr) }} · {{ a.desc }}</div>
            </div>
            <div class="crt_agent__status">{{ agentBadge(a.addr) }}</div>
            <div class="crt_agent__actions">
              <template v-if="a.kind === 'backup'">
                <input v-model="backupArm" placeholder="type DEREGISTER" class="crt_arm_input">
                <v-btn color="primary" variant="outlined" size="small" :disabled="backupArm.trim().toUpperCase() !== 'DEREGISTER'" @click="stageAgent(a)">Register</v-btn>
              </template>
            </div>
          </div>
        </div>
      </div>

      <aside class="crt_aside">
        <div v-if="!staged" class="crt_card crt_card--empty">
          <div class="crt_stat__label">Simulate &amp; sign</div>
          <p>Pick an action on the left. Every call is assembled programmatically, wrapped for the Roles modifier, simulated from the whitelisted sender, and only then handed to the wallet. No copy-pasting hex.</p>
        </div>
        <div v-else class="crt_card">
          <div class="crt_panel_head">
            <div>
              <div class="crt_stat__label">Simulate &amp; sign</div>
              <div class="crt_panel_title">{{ staged.title }}</div>
            </div>
            <v-btn variant="text" size="small" @click="staged = null">✕</v-btn>
          </div>
          <div v-for="wtext in staged.warns || []" :key="wtext" class="crt_warn">{{ wtext }}</div>
          <label v-if="staged.confirmPhrase" class="crt_confirm">
            <input v-model="confirmed" type="checkbox">
            <span>I understand: {{ staged.confirmPhrase }}</span>
          </label>
          <div :class="{ crt_gated: staged.confirmPhrase && !confirmed }">
            <div v-for="(step, i) in staged.steps" :key="i" class="crt_step">
              <div class="crt_step__head"><b>{{ step.label }}</b><span class="crt_mono_dim">{{ step.wrapped.inner.sig }}</span></div>
              <div v-for="p in step.wrapped.inner.params" :key="p.k" class="crt_param"><span>{{ p.k }}</span><span>{{ p.v }}<em v-if="p.pinned" class="crt_pinned"> · pinned</em></span></div>
              <div class="crt_mono_dim">to Roles {{ shortAddr(CRT.ADDR.roles) }} · execTransactionWithRole(role {{ staged.role }}) {{ crtValidateWrapped(step.wrapped.data) ? "· 0x6928e74b ✓" : "· BAD PREFIX" }}</div>
              <div class="crt_hex">{{ step.wrapped.data }}</div>
              <div v-if="step.sim" class="crt_sim" :class="step.sim === 'pending' ? '' : step.sim.ok ? 'crt_sim--ok' : step.sim.soft && step.expectSoftFail ? 'crt_sim--soft' : 'crt_sim--bad'">
                <template v-if="step.sim === 'pending'">simulating from the whitelisted sender…</template>
                <template v-else-if="step.sim.ok">✓ simulation passed</template>
                <template v-else>✗ {{ step.sim.name }}<div class="crt_sim__hint">{{ step.sim.soft && step.expectSoftFail ? "Expected before the approve step is mined. Not a permission failure." : step.sim.hint }}</div></template>
              </div>
              <div class="crt_step__actions">
                <span v-if="step.txStatus === 'pending'" class="crt_mono_dim">pending {{ shortAddr(step.txHash) }}…</span>
                <a v-if="step.txStatus === 'ok'" :href="CRT.EXPLORER + '/tx/' + step.txHash" target="_blank" class="crt_ok">✓ mined · view</a>
                <span v-if="step.txStatus === 'fail'" class="crt_bad">✗ reverted on-chain</span>
                <v-btn variant="text" size="small" @click="simulateStep(step)">Re-simulate</v-btn>
                <v-btn v-if="staged.role === 1" color="primary" variant="outlined" size="small" :disabled="!isManager || step.txStatus === 'pending' || step.txStatus === 'ok'" :title="isManager ? '' : 'Connect the manager EOA'" @click="exec(step)">{{ step.txStatus === "ok" ? "Executed" : "Execute" }}</v-btn>
                <v-btn v-else color="primary" variant="outlined" size="small" @click="copyText(step.wrapped.data)">Copy for Safe</v-btn>
              </div>
            </div>
          </div>
          <div v-if="staged.steps.length > 1" class="crt_stat__sub" style="margin-top: 10px">Step 2 always fails simulation until step 1 is mined; the pre-flight ✗ on it is expected, not an error.</div>
        </div>
        <p class="crt_footnote">Every transaction goes to the Roles modifier {{ shortAddr(CRT.ADDR.roles) }} as execTransactionWithRole: value 0, operation Call, shouldRevert true. Nothing here can reach an arbitrary address.</p>
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
const totalNav = computed(() => {
  if (!bal.value || !core.value) return "—";
  const evm = Number(ethers.formatUnits(bal.value.safeUsdc + bal.value.felixAssets + bal.value.hlend + bal.value.fundUsdc, 6));
  return n2(evm + core.value.spotUsdc + core.value.perpValue) + " USDC";
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
const agentBadge = (addr: string) => {
  const s = agentsStatus[addr.toLowerCase()];
  if (!s) return "checking…";
  if (s.error) return "unknown";
  if (s.live && s.ours) return "● live · agent of Safe";
  if (s.live) return "● agent of another user";
  return "○ not registered";
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
.crt_console { display: flex; flex-direction: column; gap: 24px; margin-bottom: 40px; }
.crt_card { border: 1px solid $color-border-dark; background: $color-gray-light-transparent; border-radius: $default-border-radius; padding: 20px; display: flex; flex-direction: column; gap: 12px; }
.crt_card--payout { border-color: rgba(230, 106, 96, 0.35); }
.crt_card--empty p { color: $color-light-subtitle; font-size: 13.5px; line-height: 1.6; margin: 8px 0 0; }
.crt_status { flex-direction: row; align-items: center; gap: 34px; flex-wrap: wrap; }
.crt_status__right { margin-left: auto; display: flex; align-items: center; gap: 16px; }
.crt_stat { display: flex; flex-direction: column; gap: 3px; }
.crt_stat--right { text-align: right; }
.crt_stat__label { font-family: monospace; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: $color-text-irrelevant; }
.crt_stat__value { font-family: monospace; font-size: 17px; }
.crt_stat__sub { font-size: 12px; color: $color-light-subtitle; }
.crt_layout { display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: 24px; align-items: start; }
@media (max-width: 1180px) { .crt_layout { grid-template-columns: 1fr; } }
.crt_main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.crt_aside { position: sticky; top: 16px; display: flex; flex-direction: column; gap: 12px; }
.crt_h2 { font-size: 20px; font-weight: 700; margin: 20px 0 0; display: flex; align-items: center; gap: 12px; }
.crt_role2_tag { font-family: monospace; font-size: 11px; letter-spacing: 0.06em; color: var(--color-error, #e66a60); border: 1px solid rgba(230, 106, 96, 0.35); border-radius: $default-border-radius; padding: 4px 9px; }
.crt_danger_tag { font-family: monospace; font-size: 10.5px; letter-spacing: 0.08em; color: var(--color-error, #e66a60); margin-left: 6px; }
.crt_card__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.crt_card__title { font-weight: 700; font-size: 15px; }
.crt_card__sub { font-size: 12.5px; color: $color-light-subtitle; }
.crt_row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.crt_row > * { flex: 1; min-width: 120px; }
.crt_row > .v-btn { flex: 0 0 auto; min-width: 0; }
.crt_grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; }
.crt_agent { display: grid; grid-template-columns: minmax(0, 1.6fr) auto auto; gap: 14px; align-items: center; padding: 12px 0; border-top: 1px solid $color-border-dark; }
.crt_agent:first-of-type { border-top: 0; padding-top: 0; }
.crt_agent__name { font-weight: 700; font-size: 14px; }
.crt_agent__status { font-family: monospace; font-size: 12px; color: $color-light-subtitle; white-space: nowrap; }
.crt_agent__actions { display: flex; gap: 8px; align-items: center; }
.crt_arm_input { width: 150px; background: transparent; border: 1px solid $color-border-dark; border-radius: $default-border-radius; color: var(--color-error, #e66a60); font-family: monospace; font-size: 11.5px; padding: 7px 10px; outline: none; }
.crt_panel_head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.crt_panel_title { font-weight: 700; font-size: 15.5px; margin-top: 4px; }
.crt_warn { border: 1px solid rgba(230, 106, 96, 0.35); background: rgba(230, 106, 96, 0.1); border-radius: $default-border-radius; padding: 9px 12px; font-size: 12.5px; line-height: 1.5; color: var(--color-error, #e66a60); }
.crt_confirm { display: flex; gap: 10px; align-items: flex-start; font-size: 12.5px; line-height: 1.5; color: $color-light-subtitle; cursor: pointer; }
.crt_gated { opacity: 0.35; pointer-events: none; }
.crt_gated, .crt_step { display: flex; flex-direction: column; gap: 10px; }
.crt_step { border: 1px solid $color-border-dark; border-radius: $default-border-radius; padding: 12px; margin-top: 10px; }
.crt_step__head { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; font-size: 13px; }
.crt_mono_dim { font-family: monospace; font-size: 11px; color: $color-text-irrelevant; word-break: break-all; }
.crt_pinned { font-style: normal; color: $color-text-irrelevant; font-size: 10.5px; }
.crt_param { display: flex; justify-content: space-between; gap: 12px; font-family: monospace; font-size: 12px; span:first-child { color: $color-text-irrelevant; text-transform: uppercase; letter-spacing: 0.05em; } }
.crt_hex { font-family: monospace; font-size: 10.5px; line-height: 1.6; color: $color-light-subtitle; word-break: break-all; max-height: 96px; overflow: auto; border: 1px solid $color-border-dark; border-radius: $default-border-radius; padding: 8px 10px; }
.crt_sim { border-radius: $default-border-radius; padding: 8px 11px; font-family: monospace; font-size: 12px; line-height: 1.5; border: 1px solid $color-border-dark; color: $color-light-subtitle; }
.crt_sim--ok { color: var(--color-success); border-color: rgba(47, 215, 255, 0.3); }
.crt_sim--bad { color: var(--color-error, #e66a60); border-color: rgba(230, 106, 96, 0.35); }
.crt_sim--soft { color: $color-light-subtitle; }
.crt_sim__hint { font-family: inherit; font-size: 11.5px; opacity: 0.85; }
.crt_step__actions { display: flex; gap: 8px; justify-content: flex-end; align-items: center; flex-wrap: wrap; }
.crt_ok { color: var(--color-success); font-family: monospace; font-size: 12px; }
.crt_bad { color: var(--color-error, #e66a60); font-family: monospace; font-size: 12px; }
.crt_footnote { font-size: 11.5px; line-height: 1.6; color: $color-text-irrelevant; margin: 0; }
</style>
